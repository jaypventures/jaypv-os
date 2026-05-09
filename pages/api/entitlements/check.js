import { readRequestBody, jsonResponse } from "../../../lib/jpv/http";
import { verifySignature } from "../../../lib/jpv/signing";
import { evaluateEntitlement } from "../../../lib/jpv/entitlements";
import { createAuditEvent } from "../../../lib/jpv/audit";

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return jsonResponse(res, 405, {
      status: "error",
      error: "method_not_allowed"
    });
  }

  const rawBody = await readRequestBody(req);
  const signature = req.headers["x-jpv-signature"];
  const secret = process.env.JPV_INTERNAL_SIGNING_SECRET;

  const valid = verifySignature({
    rawBody,
    signature,
    secret
  });

  if (!valid) {
    return jsonResponse(res, 401, {
      status: "denied",
      decision: "deny",
      reason: "invalid_signature",
      auditRequired: true
    });
  }

  let payload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse(res, 400, {
      status: "error",
      decision: "deny",
      reason: "invalid_json"
    });
  }

  const result = evaluateEntitlement(payload);
  const auditEvent = createAuditEvent({ payload, result });

  return jsonResponse(res, 200, {
    status: "ok",
    system: "JPV-OS",
    service: "runtime-entitlement-api",
    version: "0.2.1",
    ...result,
    audit: auditEvent
  });
}
