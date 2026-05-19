export async function getCloudflareEnv() {
  const mod = await import("@opennextjs/cloudflare");
  const context = await mod.getCloudflareContext({ async: true });
  return context.env;
}

export function createId(prefix) {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2)
  );
}
