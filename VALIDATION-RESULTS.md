# Verified release — 2026-09-25

Live site: https://master.d1b6dmf1w1balm.amplifyapp.com/

Application release: `dcc04078f356c65a84a8f6a461dc7b3f5b5db0c6`.
Amplify job 119 completed BUILD, DEPLOY and VERIFY successfully.
Backend: `parking-management-unified-api` in `ca-central-1`.

## Verification

- 27 local regression tests passed.
- TypeScript checking and production Vite build passed.
- Real production AppSync integration passed 15 scenarios covering all 23 API operations, with no failures or cleanup errors.
- Real Lambda integration independently passed the same 23-operation coverage.
- Scenarios cover Cognito temporary-password sign-in, access control, separate accounts sharing a generated household code, concurrent booking exclusion, shared reservation visibility/cancellation, CRUD and CSV import/export.
- Browser checks confirmed the deployed guest form, resident-code validation, staff login and no console errors.

## Final data audit

Read-only AWS audit at 2026-09-25 19:44 UTC confirmed:

| Resource | Remaining records/accounts |
| --- | ---: |
| Residents | 0 |
| Reservations | 0 |
| Audit logs | 0 |
| Household registry | 0 |
| Resident Cognito group | 0 |
| Integration-test Cognito users | 0 |
| Administrators preserved | 1 |
| Parking configurations preserved | 1 |

The user authorized removal of existing fake data. Backups and detailed machine-readable test reports are retained locally under ignored `build/backups/` and `build/`; credentials and personal data are not committed.

See RELEASE.md for implementation, deployment, rollback and known operational limits. These checks establish the tested behaviors, not a guarantee against every possible defect.

## Responsive follow-up

The initial API release did not establish mobile usability. The follow-up fixes the duplicate form-grid rule, intrinsic input overflow, duration controls, wrapping toolbars, readable mobile table cards, touch targets and scrollable dialogs.

Validation: 98 browser checks (14 page/state checks at each of 320, 375, 390, 430, 768, 1024 and 1440 CSS pixels) passed in headless Edge. They render the actual React components with isolated in-memory authentication/data and cover guest validation/success, login/new-password state, admin tabs, detail/extension/create dialogs and the resident dashboard. No AWS records are created by this suite. Screenshots and measurements are under ignored `build/responsive/`. This is viewport emulation, not physical-device or Safari certification.

Run with an installed Playwright module: `node test/responsive.mjs`. If Playwright is provided by a separate runtime, set `PLAYWRIGHT_MODULE` to its absolute module path. Microsoft Edge must be installed. Local regression tests (27), TypeScript checking and the production Vite build also passed after the changes.

## Guard release — 2026-09-28

Added the Cognito GUARD group, admin account creation/enable/disable controls and
a dedicated read-only view of active bookings with emergency guest/host details.
Guard tokens are denied every other operation, including all mutations and
private resident/export reads. Existing accounts cannot be upgraded through the
guard creation form. The existing Cognito pool requires email as username.

Validation completed before frontend publication:

- 31 regression tests passed, including all guard authorization boundaries,
  inactive booking filtering, safe response fields, account rollback and revocation.
- TypeScript checking and the production Vite build passed.
- 112 browser layout/state checks passed at seven viewport widths, including
  admin guard creation/disabling and the guard's plate search/read-only controls.
- Real Cognito + Lambda validation and production AppSync validation each passed
  18 scenarios covering all 27 API operations, with no cleanup errors.
- A real GUARD token was denied all 26 other operations. Disabled guard access
  was rejected even using the already-issued token; cancelled bookings disappeared.
- All generated test accounts/records were removed by scoped fixture cleanup.

Detailed reports: ignored `build/guard-lambda-report.json`,
`build/guard-appsync-report.json` and `build/responsive/report.json`.
See RELEASE.md for account behavior and the distinction between active bookings
and physical vehicle presence.

The frontend was published successfully by Amplify job 121, commit `667f884`.
The live browser smoke test then passed admin guard creation, Cognito first-login
password change on mobile, read-only guard navigation and revocation of an
already-signed-in guard. Its disposable accounts were removed without errors.
Run `test/guard-browser.cjs --write-fixtures` with PLAYWRIGHT_MODULE configured
to repeat this scoped production check. Report: `build/guard-browser-report.json`.
