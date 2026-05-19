# Release Verification Checklist

Before merging:

- [ ] 
pm ci succeeds.
- [ ] 
pm run build --if-present succeeds.
- [ ] 
pm audit --audit-level=high reviewed.
- [ ] No live secrets committed.
- [ ] .env.example updated when environment variables change.
- [ ] Webhook behavior tested.
- [ ] Entitlement flow tested.
- [ ] Rollback path documented.
- [ ] Trust artifacts remain present.
