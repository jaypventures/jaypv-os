export async function getCloudflareEnv() {
  const mod = await import("@opennextjs/cloudflare");
  const context = await mod.getCloudflareContext({ async: true });
  return context.env;
}

export function createAuditId() {
  return (
    "audit_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2)
  );
}

export function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

export function isActiveEntitlement(row) {
  return row && normalizeStatus(row.status) === "active";
}
