import crypto from "node:crypto";
import {
  getCloudflareEnv,
  createAuditId,
  isActiveEntitlement
} from "../../../lib/jpv/storage";

function createSignature(body, secret) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function safeCompare(a, b) {
  if (!a || !b) return false;

  const left = Buffer.from(String(a), "hex");
  const right = Buffer.from(String(b), "hex");

  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
}

function deny(reason, extra = {}) {
  return {
    decision: "deny",
    reason,
    checkedAt: new Date().toISOString(),
    ...extra
  };
}

async function findEntitlement(env, payload) {
  const subjectId = payload.subjectId;
  const requestedAccess = payload.requestedAccess;

  const cacheKey = `entitlement:${subjectId}:${requestedAccess}`;
  const cached = await env.ENTITLEMENT_KV.get(cacheKey, "json");

  if (cached) {
    return {
      source: "kv",
      record: cached
    };
  }

  const query = await env.JPV_OS_DB.prepare(
    `SELECT id, subject_id, subject_type, tier, status, source, created_at, updated_at
     FROM entitlements
     WHERE subject_id = ? AND tier = ?
     LIMIT 1`
  )
    .bind(subjectId, requestedAccess)
    .first();

  if (query) {
    await env.ENTITLEMENT_KV.put(cacheKey, JSON.stringify(query), {
      expirationTtl: 300
    });

    return {
      source: "d1",
      record: query
    };
  }

  return {
    source: "none",
    record: null
  };
}

async function writeAudit(env, payload, result) {
  const audit = {
    id: createAuditId(),
    eventType: "entitlement.check",
    subjectId: payload?.subjectId ?? null,
    requestedAccess: payload?.requestedAccess ?? null,
    decision: result.decision,
    reason: result.reason,
    createdAt: new Date().toISOString(),
    reversible: true,
    humanReviewSupported: true,
    metadata: {
      source: payload?.source ?? "unknown",
      entitlementSource: result.entitlementSource ?? "none"
    }
  };

  await env.AUDIT_KV.put(`audit:${audit.id}`, JSON.stringify(audit), {
    expirationTtl: 60 * 60 * 24 * 30
  });

  await env.JPV_OS_DB.prepare(
    `INSERT INTO audit_events
      (id, event_type, actor_id, subject_id, decision, reason, created_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      audit.id,
      audit.eventType,
      null,
      audit.subjectId,
      audit.decision,
      audit.reason,
      audit.createdAt,
      JSON.stringify(audit.metadata)
    )
    .run();

  return audit;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      decision: "deny",
      reason: "method_not_allowed"
    });
  }

  try {
    const env = await getCloudflareEnv();

    const secret = env.JPV_INTERNAL_SIGNING_SECRET || process.env.JPV_INTERNAL_SIGNING_SECRET;
    const signature = req.headers["x-jpv-signature"];

    const payload = req.body;
    const canonicalBody = JSON.stringify(payload);

    const expected = createSignature(canonicalBody, secret);
    const valid = safeCompare(signature, expected);

    if (!valid) {
      return res.status(401).json({
        status: "denied",
        decision: "deny",
        reason: "invalid_signature",
        auditRequired: true
      });
    }

    if (!payload?.subjectId) {
      const result = deny("missing_subject_id");
      const audit = await writeAudit(env, payload, result);

      return res.status(200).json({
        status: "ok",
        system: "JPV-OS",
        service: "runtime-entitlement-api",
        version: "0.2.2",
        ...result,
        audit
      });
    }

    if (!payload?.requestedAccess) {
      const result = deny("missing_requested_access", {
        subjectId: payload.subjectId
      });
      const audit = await writeAudit(env, payload, result);

      return res.status(200).json({
        status: "ok",
        system: "JPV-OS",
        service: "runtime-entitlement-api",
        version: "0.2.2",
        ...result,
        audit
      });
    }

    const lookup = await findEntitlement(env, payload);

    let result;

    if (isActiveEntitlement(lookup.record)) {
      result = {
        decision: "allow",
        reason: "active_entitlement_record",
        checkedAt: new Date().toISOString(),
        subjectId: payload.subjectId,
        requestedAccess: payload.requestedAccess,
        entitlementSource: lookup.source,
        entitlementId: lookup.record.id
      };
    } else {
      result = {
        decision: "deny",
        reason: "no_active_entitlement_record",
        checkedAt: new Date().toISOString(),
        subjectId: payload.subjectId,
        requestedAccess: payload.requestedAccess,
        entitlementSource: lookup.source
      };
    }

    const audit = await writeAudit(env, payload, result);

    return res.status(200).json({
      status: "ok",
      system: "JPV-OS",
      service: "runtime-entitlement-api",
      version: "0.2.2",
      ...result,
      audit
    });
  } catch (error) {
    return res.status(200).json({
      status: "guarded",
      decision: "deny",
      reason: "runtime_exception_guarded",
      message: error?.message ?? "unknown_error",
      auditRequired: true
    });
  }
}
