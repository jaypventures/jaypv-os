import Stripe from "stripe";
import { getCloudflareEnv, createId } from "../../../lib/jpv/cloudflare";
import { mapStripeEventToEntitlement } from "../../../lib/jpv/stripe-entitlements";

export const config = {
  api: {
    bodyParser: false
  }
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;
    });

    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function writeAudit(env, event, decision, reason, metadata = {}) {
  const id = createId("audit");

  const audit = {
    id,
    eventType: "stripe.webhook",
    subjectId: event?.id ?? null,
    decision,
    reason,
    createdAt: new Date().toISOString(),
    metadata
  };

  await env.AUDIT_KV.put(`audit:${id}`, JSON.stringify(audit), {
    expirationTtl: 60 * 60 * 24 * 30
  });

  await env.JPV_OS_DB.prepare(
    `INSERT INTO audit_events
      (id, event_type, actor_id, subject_id, decision, reason, created_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      audit.eventType,
      "stripe",
      audit.subjectId,
      decision,
      reason,
      audit.createdAt,
      JSON.stringify(metadata)
    )
    .run();

  return audit;
}

async function upsertEntitlement(env, entitlement) {
  await env.JPV_OS_DB.prepare(
    `INSERT OR REPLACE INTO entitlements
      (id, subject_id, subject_type, tier, status, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      entitlement.id,
      entitlement.subject_id,
      entitlement.subject_type,
      entitlement.tier,
      entitlement.status,
      entitlement.source,
      entitlement.created_at,
      entitlement.updated_at
    )
    .run();

  await env.ENTITLEMENT_KV.put(
    `entitlement:${entitlement.subject_id}:${entitlement.tier}`,
    JSON.stringify(entitlement),
    { expirationTtl: 300 }
  );

  await env.CUSTOMER_KV.put(
    `stripe_customer:${entitlement.subject_id}`,
    JSON.stringify(entitlement),
    { expirationTtl: 60 * 60 * 24 * 30 }
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      reason: "method_not_allowed"
    });
  }

  const env = await getCloudflareEnv();
  const rawBody = await readRawBody(req);
  const signature = req.headers["stripe-signature"];

  const webhookSecret =
    env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return res.status(500).json({
      status: "error",
      reason: "missing_stripe_webhook_secret"
    });
  }

  let event;

  try {
    const stripe = new Stripe("sk_test_placeholder", {
      apiVersion: "2025-09-30.clover"
    });

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (error) {
    return res.status(400).json({
      status: "error",
      reason: "stripe_signature_verification_failed",
      message: error?.message ?? "unknown_error"
    });
  }

  const eventKey = `stripe_event:${event.id}`;

  const alreadyProcessed = await env.AUDIT_KV.get(eventKey);

  if (alreadyProcessed) {
    return res.status(200).json({
      status: "ok",
      decision: "ignored",
      reason: "duplicate_event",
      eventId: event.id
    });
  }

  await env.AUDIT_KV.put(eventKey, "processed", {
    expirationTtl: 60 * 60 * 24 * 30
  });

  const entitlement = mapStripeEventToEntitlement(event);

  if (!entitlement) {
    await writeAudit(env, event, "ignored", "unsupported_event_type", {
      stripeEventType: event.type
    });

    return res.status(200).json({
      status: "ok",
      decision: "ignored",
      reason: "unsupported_event_type",
      eventId: event.id,
      eventType: event.type
    });
  }

  await upsertEntitlement(env, entitlement);

  const audit = await writeAudit(env, event, "allow", "entitlement_synced", {
    stripeEventType: event.type,
    entitlementId: entitlement.id,
    tier: entitlement.tier,
    entitlementStatus: entitlement.status
  });

  return res.status(200).json({
    status: "ok",
    decision: "allow",
    reason: "entitlement_synced",
    eventId: event.id,
    eventType: event.type,
    entitlement,
    audit
  });
}
