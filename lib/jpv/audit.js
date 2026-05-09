export function createAuditEvent({ payload, result }) {
  return {
    id: crypto.randomUUID(),
    eventType: "entitlement.check",
    subjectId: payload?.subjectId ?? null,
    requestedAccess: payload?.requestedAccess ?? null,
    decision: result.decision,
    reason: result.reason,
    createdAt: new Date().toISOString(),
    reversible: true,
    humanReviewSupported: true
  };
}
