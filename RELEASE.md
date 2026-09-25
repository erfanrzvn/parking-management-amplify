# Parking API release — 2026-09-25

The current app uses AppSync `p6u7zkzkhrbuter3jhkvujkhpa` in `ca-central-1`,
Cognito pool `ca-central-1_dBeo5yZXq`, and Amplify app `d1b6dmf1w1balm`, branch
`master`. The different AppSync ID in older project notes is a legacy backend.

## Authoritative implementation

- `schema.graphql`: deployed GraphQL contract and public/private field access.
- `lambda/api.js`: all 23 query/mutation operations, including the legacy CSV
  export mutation. Every resolver delegates to this handler.
- `lambda/households.js`: one server-generated six-character code per normalized
  building/unit, shared by separate resident accounts. A transactional registry
  enforces address/code uniqueness, including concurrent creates and imports.
- `lambda/reservationStore.js`: serialized reservation/capacity writes with a
  lease and fencing token checked inside the commit transaction.
- `cloudformation/api-runtime.yaml`: additive runtime stack, existing business
  tables supplied by name. Does not replace Resident or Reservation tables.
- `scripts/appsync-runtime.js`: common AppSync resolver source.

The older `amplify/data/resource.ts`, schema snapshots, zipped Lambda files and
`cloudformation/appsync-dynamodb.yaml` are legacy scaffolding. Do not deploy those
over this API. The Amplify pipeline builds only the frontend.

## Behavior

Accounts remain individual. Residents in the same building and unit share a code
and can see/cancel their household's booking; only one guest can be active for
that household. Different households cannot use an already-booked guest plate.
Codes cannot be submitted or edited through create/update inputs or CSV imports.

Guest verification requires code and unit; booking verifies them again on the
server. Caller-supplied floor/plate are ignored. Capacity sums all parking lots;
booking duration and extensions are limited to 24 hours. Cancelled bookings stay
in history and no longer occupy capacity.

Private profile data, resident lists, exports and management operations require
Cognito. The Lambda checks ADMIN membership and resident ownership. Public
API-key access is limited to parking availability and guest booking/verification.
Verification attempts are counted atomically and fail closed on storage errors.

CSV imports use the same account/code path as manual creation. Credentials for
new accounts are returned only to the authenticated administrator and downloaded
by the browser; they are not saved in DynamoDB or application logs. The login
form handles Cognito's required new-password challenge. Email changes remain
disabled because changing an account's sign-in identity requires a separate
account migration; other profile fields can be edited.

## Validation

```powershell
npm ci
npm ci --prefix lambda
npm test
npm run typecheck
npx vite build --outDir=build/frontend
python -X utf8 scripts/package-release.py
```

The regression suite covers frontend GraphQL contracts, all handler categories,
authorization, pagination, shared codes, concurrency, rollback, CSV, capacity,
booking and cancellation. It uses an in-memory AWS adapter, not an AWS emulator.

`test/live-api.cjs --write-fixtures` exercises 23 operations with real Cognito
accounts and AWS storage. It keeps fixture IDs and cleans up exactly those
records/users on success or failure. `TEST_LAMBDA_FUNCTION` selects direct AWS
Lambda validation with a local GraphQL executor; without it, requests go through
the configured AppSync endpoint. These are distinct test modes. Set
`HOUSEHOLD_TABLE` to the runtime stack output. Reports live under ignored
`build/`; reports never contain tokens or passwords.

## Deployment and rollback

Runtime stack: `parking-management-unified-api`.
Lambda: `parking-management-unified-api-ApiFunction-xqwqpJ5VnvoS`.
Household table: `parking-management-unified-api-HouseholdRegistry-DCZ0KUU86DEW`.

1. Back up the current schema, resolvers, tables and template under ignored
   `build/backups/`; verify the AWS account is `103103683543`.
2. Upload a new immutable API zip key to the existing regional deployment bucket
   and update `cloudformation/api-runtime.yaml` using the matching CodeKey.
3. Run direct AWS validation before changing production resolvers.
4. During cutover, temporarily pause mutations with
   `node scripts/enable-maintenance.cjs`. Never leave this enabled after a failed
   deployment: restore the saved resolver definitions or finish the cutover.
5. Upload `schema.graphql` through `start-schema-creation` and wait for SUCCESS.
   Set `APPSYNC_API_ID` and `AWS_REGION`, then run
   `node scripts/switch-resolvers.cjs` to route every field to ParkingUnifiedApi.
6. Run the live test again through AppSync, then publish the frontend by pushing
   the reviewed source commit to `master`. This Amplify app is repository-backed;
   its create-deployment upload API is not supported.
7. Check the Amplify job reaches SUCCEED and verify the served asset hashes and
   public/private API behavior. Remove test fixtures and verify table counts.

For rollback, restore the saved schema and each saved Query/Mutation resolver
definition, and redeploy the previous frontend commit. The additive runtime can
remain unattached while recovery is performed. Do not restore old test data
after the user's explicitly requested reset.

The user confirmed that all existing resident/reservation information was test
data and authorized its removal. `scripts/reset-test-data.cjs --apply` clears
the scoped resident/reservation/registry/rate-limit/audit tables after backing
them up, deletes only matching resident Cognito accounts, and preserves ADMIN
accounts and parking configuration. It is not part of ordinary deployments.

## Operational limits

The API currently scans small DynamoDB tables and serializes booking writes.
This favors correctness for this small deployment; a larger property should use
indexed household lookups and more granular capacity allocation. Bulk CSV work
must fit AppSync/Lambda's synchronous timeout; large imports need a background
job. Optional MFA challenges beyond the new-password challenge are not yet
implemented in the custom login form. Per-IP limits are not a substitute for WAF.

AWS references: [AppSync resolver context](https://docs.aws.amazon.com/appsync/latest/devguide/resolver-context-reference.html),
[Lambda Node.js packaging](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-package.html).
