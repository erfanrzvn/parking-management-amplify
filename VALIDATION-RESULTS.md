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
