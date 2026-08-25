# Migration Guide: Mock → Real LeanIX

The whole point of this simulator is that switching to a real LeanIX workspace should be a config change, not a code change.

## The adapter boundary

Your application (not this repo) should own an adapter interface and switch on `LEANIX_MODE`:

```typescript
interface ILeanIXAdapter {
  queryFactSheets(filter: FilterInput): Promise<FactSheetConnection>;
  getFactSheet(id: string): Promise<FactSheet>;
  createFactSheet(input: BaseFactSheetInput): Promise<FactSheet>;
  updateFactSheet(id: string, patches: Patch[]): Promise<FactSheet>;
  archiveFactSheet(id: string): Promise<FactSheet>;
  runLDIF(ldif: LDIF): Promise<SyncRun>;
  registerWebhook(config: WebhookConfig): Promise<Webhook>;
}

const adapter = process.env.LEANIX_MODE === 'mock' ? new MockLeanIXAdapter() : new RealLeanIXAdapter();
```

Both implementations point at the *same* URL shapes (`/services/pathfinder/v1/graphql`, `/services/mtm/v1/oauth2/token`, etc.) because this mock deliberately replicates LeanIX's real API surface rather than inventing a simplified one. That's what makes the swap safe.

## What to change when going live

| Setting | Mock | Real |
|---|---|---|
| `LEANIX_MODE` | `mock` | `real` |
| `LEANIX_BASE_URL` | `http://localhost:4000` | `https://<subdomain>.leanix.net` |
| `LEANIX_SUBDOMAIN` | `mock` | your real subdomain |
| `LEANIX_API_TOKEN` / `_SECRET` | `dev-token-*` / `dev-secret-*` | real API token/secret from LeanIX workspace settings |
| `LEANIX_WORKSPACE` | `development` | your real workspace name |

Nothing else in your application code should need to change — same GraphQL queries/mutations, same REST paths, same JWT bearer auth flow, same LDIF structure, same webhook payload/signature scheme.

## Things that behave differently in real LeanIX (verify before cutover)

- **Meta model**: this mock's default meta model (9 types, the attributes in `packages/shared/src/constants/default-meta-model.ts`) is a reasonable approximation, not a byte-for-byte replica of any specific real workspace's custom meta model. Re-check your queries against your actual workspace's `allFactSheetTypes` before relying on field names.
- **Allowed values**: `functionalSuitability`/`technicalSuitability`/`businessCriticality` enum values here are illustrative (see `docs/BUILD_STATUS.md` ambiguity resolutions) — a real workspace may use different value sets.
- **Rate limits**: real LeanIX enforces its own published limits; this mock's 1800/1200 per-minute limits are configurable and may not match exactly.
- **`FACT_SHEET_TYPE_NOT_FOUND` / relation availability**: only exists here for the 9 seeded types and 5 relation types — a real workspace will have its own custom types/relations.
- **OAuth scopes**: neither mock nor real LeanIX uses OAuth scopes for authorization (both are role-based) — no behavior change here.

## Testing the cutover

1. Point `LEANIX_BASE_URL`/`LEANIX_API_TOKEN`/`LEANIX_API_TOKEN_SECRET` at a real (ideally sandbox) LeanIX workspace.
2. Re-run your application's existing integration test suite against it unmodified — it should pass the same way it does against this mock, since the API contracts match.
3. Diff `allFactSheetTypes` between mock and real to catch any field-name assumptions baked into your app during mock-only development.
