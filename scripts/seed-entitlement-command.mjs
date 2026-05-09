const subjectId = process.argv[2] || "test-subject";
const tier = process.argv[3] || "jpvos:test";

console.log(`
Run this command to seed an active test entitlement:

npx wrangler d1 execute jpv_os_core --command "INSERT OR REPLACE INTO entitlements (id, subject_id, subject_type, tier, status, source, created_at, updated_at) VALUES ('ent_${subjectId}_${tier.replace(/[^a-zA-Z0-9]/g, "_")}', '${subjectId}', 'user', '${tier}', 'active', 'manual_seed', datetime('now'), datetime('now'));"
`);
