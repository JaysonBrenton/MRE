---
created: 2026-03-22
description: Machine-generated documentation inventory manifests
purpose:
  Build-first snapshots of API route files and UI component files. Regenerate
  after structural changes; use for audits and drift checks against prose docs.
---

# Generated manifests

| File                                                             | Contents                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [`api-routes.manifest.json`](api-routes.manifest.json)           | Every `src/app/api/**/route.ts` path, derived URL segment, and exported HTTP methods |
| [`component-files.manifest.json`](component-files.manifest.json) | Every `src/components` module (excludes tests and `organisms/**/overview-testing`)   |

## Regenerate

From the Docker app container:

```bash
docker exec -it mre-app node scripts/generate-documentation-inventory.mjs
```

See also
[`docs/frontend/component-catalog.md`](../frontend/component-catalog.md) for the
human-readable UI catalog.
