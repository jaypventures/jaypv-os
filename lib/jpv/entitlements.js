export function evaluateEntitlement(payload) {
  const now = new Date().toISOString();

  if (!payload || typeof payload !== "object") {
    return {
      decision: "deny",
      reason: "invalid_payload",
      checkedAt: now
    };
  }

  if (!payload.subjectId) {
    return {
      decision: "deny",
      reason: "missing_subject_id",
      checkedAt: now
    };
  }

  if (!payload.requestedAccess) {
    return {
      decision: "deny",
      reason: "missing_requested_access",
      checkedAt: now
    };
  }

  return {
    decision: "deny",
    reason: "no_active_entitlement_record",
    checkedAt: now,
    subjectId: payload.subjectId,
    requestedAccess: payload.requestedAccess
  };
}
