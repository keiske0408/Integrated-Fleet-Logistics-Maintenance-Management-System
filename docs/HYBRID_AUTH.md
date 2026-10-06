# Hybrid Authentication

**Status (2026-10-05):** The Entra and Fleet-local authentication paths are implemented. Production use remains dependent on environment configuration, identity provisioning, and a secure first-admin bootstrap. Real Entra and SMTP round trips have not been verified in this environment.

## Identity Model

Both sign-in methods resolve to the same active Fleet user in `users`. That user’s internal role is mapped to the backend authorization policy; the browser does not choose the production role.

- Microsoft Entra access tokens are verified by the API using the tenant JWKS, issuer, audience, tenant ID, and object ID. The `(provider, issuer, subject)` identity must already be linked to a Fleet user. The Entra subject is `tid:oid`.
- Fleet-local credentials are Argon2id hashes associated with an active Fleet user. Successful login creates an opaque, expiring server-side session; only HMAC hashes of the session and CSRF tokens are stored.
- Identity linking is explicit and administrative. The system does not automatically link accounts by matching email addresses.
- Inactive users and unlinked identities are denied. Production does not trust `x-user-id`, `x-user-role`, or other simulated identity headers.
- Non-Microsoft users can request local accounts. Signup options load active Department LOV items and supported roles from the backend Role catalog. The applicant's role is a preference only; an administrator selects the final supported non-admin role after email verification. Signup never creates a session or grants access.

## Local Session And Reset

Local login sets a `fleet_session` cookie (HttpOnly) and a `fleet_csrf` cookie (readable by the SPA). State-changing requests must echo the CSRF token in `X-CSRF-Token`. Cookies use `SameSite=Lax` in development; production uses `SameSite=None; Secure`, so production must be served over HTTPS and CORS must use the exact SPA origin with credentials enabled.

Logout revokes the server-side session. Password reset responds generically whether an eligible account exists or not. When SMTP is configured and the user has local credentials, the API sends a single-use reset link. The token is stored hashed, expires after `PASSWORD_RESET_TTL_MINUTES` (30 minutes by default), and is placed in the URL fragment so it is not sent in the HTTP request to the SPA. Completing a reset consumes the token and revokes existing sessions.

## API Operations

All routes are mounted under `/api/auth`:

| Route                                                        | Access                                 | Behavior                                                                                                                                                                               |
| ------------------------------------------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /local/login`                                          | Public, rate-limited                   | Verifies local credentials and creates session/CSRF cookies.                                                                                                                           |
| `GET /signup/options`                                        | Public, read-only                      | Returns active Department LOV codes/labels and role-catalog entries supported by backend CASL.                                                                                         |
| `POST /local/signup`                                         | Public, rate-limited                   | Stores a pending request and mails a 24-hour verification link; creates no Fleet user/session. In development/test without SMTP, returns the verification URL in the response instead. |
| `POST /local/signup/verify`                                  | Public, rate-limited                   | Verifies email and moves the request to the administrator queue.                                                                                                                       |
| `GET /signup/requests?status=pending`                        | Fleet administrator                    | Lists verified requests awaiting review; omits password and verification-token hashes.                                                                                                 |
| `GET /signup/requests?status=approved` or `?status=rejected` | Fleet administrator                    | Lists decision history with assigned role/review time; omits password and verification-token hashes.                                                                                   |
| `POST /signup/requests/:id/approve`                          | Fleet administrator                    | Assigns an allowed non-admin role and atomically creates the active user/local identity.                                                                                               |
| `DELETE /signup/requests/:id`                                | Fleet administrator                    | Rejects a verified request and retains a sanitized decision-history record.                                                                                                            |
| `GET /me`                                                    | Authenticated                          | Returns the current linked Fleet user.                                                                                                                                                 |
| `POST /local/logout`                                         | Authenticated; CSRF for local sessions | Revokes the current local session and clears cookies.                                                                                                                                  |
| `POST /local/password-reset/request`                         | Public, rate-limited                   | Returns a generic response and sends reset mail when eligible and SMTP is available.                                                                                                   |
| `POST /local/password-reset/consume`                         | Public, rate-limited                   | Validates a reset token and changes the password.                                                                                                                                      |
| `POST /local/provision`                                      | Fleet administrator                    | Creates or updates an active user’s local credential; password must be at least 12 characters.                                                                                         |
| `POST /entra/link`                                           | Fleet administrator                    | Links an active Fleet user to the configured Entra tenant’s issuer and `tid:oid` subject.                                                                                              |

Signup requests are stored separately from `users`; they cannot authenticate while pending verification or approval. Each request stores the selected Department LOV code and requested-role preference. Approved accounts are created in `users` with that department code and the administrator's final role, then appear in the backend-backed Users view. Administrators review verified requests in the Signup Requests view, filter Pending/Approved/Disapproved history, and choose from supported non-admin roles. Signup options are limited to backend Role catalog entries with server-side CASL mappings; catalog presence alone does not grant access. User list/create/update/delete APIs are also guarded by backend `manage all` authorization.

## Department Head And TSRF Routing

Each active Department LOV item can be linked to an active Fleet user with the `approver` or `admin` role. Configure this link in Reference Data before accepting TSRFs for that department. Signup saves the Department LOV code to the Fleet user; each TSRF still selects its own department. The API resolves that item's linked approver at submission time, snapshots the user ID on the submission, and only that user (or an administrator override) may perform the initial department-head approval transition. Unassigned or ineligible department heads block TSRF submission until corrected.

## Activity History

Successful authenticated API mutations are written to the persistent `activity_logs` table with the authenticated actor, module, route/action, status, and non-sensitive metadata. Request bodies, passwords, access/reset/verification tokens, and form payloads are not captured by the general audit middleware. Authentication events use the dedicated auth audit helper. The old UI-only demo actions remain session-local and are labeled `Local UI`; they are not persisted transactions. Versioned form workflow transitions also retain detailed per-submission events in `form_submission_events`.

The provision, link, review, and user-management routes require an authenticated principal with `manage all`. Migration-seeded users have no auth identity or local credential, so they cannot initially authenticate as administrators. Bootstrap the first admin once, from the backend package directory, using a secure terminal/session environment:

```powershell
$env:BOOTSTRAP_ADMIN_EMAIL = 'superadmin@hulma.com'
$env:BOOTSTRAP_ADMIN_NAME = 'Super Administrator'
$env:BOOTSTRAP_ADMIN_PASSWORD = '<unique random password of at least 16 characters>'
$env:AUTH_SESSION_SECRET = '<random secret of at least 32 characters>'
npm run auth:bootstrap-admin
```

The command adopts the matching active seeded administrator row when possible, hashes the password with Argon2id, creates its local identity, and refuses to run if an active administrator identity already exists. It does not print or store the plaintext password. Remove the `BOOTSTRAP_ADMIN_*` values from the environment after success; do not put them in migrations or source control. Do not solve bootstrap by enabling production identity headers.

## Configuration

Set values through the hosting environment or an untracked local environment file. Never commit tenant secrets, SMTP passwords, session secrets, access tokens, or reset links.

| Variable                                                                           | Component | Purpose and production guidance                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_ENTRA_TENANT_ID`                                                             | Frontend  | Entra tenant ID.                                                                                                                                                                                                |
| `VITE_ENTRA_CLIENT_ID`                                                             | Frontend  | SPA app registration client ID.                                                                                                                                                                                 |
| `VITE_ENTRA_API_SCOPE`                                                             | Frontend  | Exposed API scope requested by MSAL. All three frontend values are required to show the Microsoft sign-in option.                                                                                               |
| `VITE_ENABLE_DEV_AUTH_HEADERS`                                                     | Frontend  | Set to `true` only for local Vite development to reveal demo users and simulated API identity. Never enable in a production build.                                                                              |
| `DATABASE_URL`                                                                     | Backend   | PostgreSQL connection. The code’s localhost fallback is development-only; configure the managed production database explicitly.                                                                                 |
| `ENTRA_TENANT_ID`                                                                  | Backend   | Tenant used for issuer, JWKS, and tenant validation.                                                                                                                                                            |
| `ENTRA_API_AUDIENCE`                                                               | Backend   | Expected audience for API access tokens.                                                                                                                                                                        |
| `ENTRA_ROLE_MAP_JSON`                                                              | Backend   | JSON allowlist mapping Entra app-role claim values to internal backend roles, for example `{"FleetAdmin":"admin","FleetTeam":"fleet_team"}`. A missing or empty mapping denies Entra authentication.            |
| `AUTH_SESSION_SECRET`                                                              | Backend   | HMAC key for session, CSRF, and reset-token hashes. Required in production; the development fallback is not suitable for production.                                                                            |
| `AUTH_SESSION_TTL_HOURS`                                                           | Backend   | Local session lifetime; defaults to 8 hours.                                                                                                                                                                    |
| `PASSWORD_RESET_TTL_MINUTES`                                                       | Backend   | Reset-token lifetime; defaults to 30 minutes.                                                                                                                                                                   |
| `FRONTEND_ORIGIN`                                                                  | Backend   | Exact allowed SPA origin for credentialed CORS and password-reset links; defaults to `http://localhost:5173`. Set the HTTPS production origin.                                                                  |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Backend   | Organization SMTP delivery. Defaults are localhost-oriented; configure a real sender and transport before offering password reset. `SMTP_USER`/`SMTP_PASSWORD` are only used when authentication is configured. |
| `ARCJET_KEY`                                                                       | Backend   | Arcjet auth rate-limit service key. The fallback limiter is process-local; configure Arcjet for production, especially when running multiple API instances.                                                     |
| `ALLOW_DEV_AUTH_HEADERS`                                                           | Backend   | Set to `true` only for local development. It has no effect in production.                                                                                                                                       |
| `NODE_ENV`                                                                         | Backend   | Use `production` for deployment; test mode explicitly permits simulated headers for integration tests.                                                                                                          |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PASSWORD`        | Backend   | One-time CLI inputs for first-admin bootstrap only. Supply at invocation time, use a unique 16+ character password, then remove them; never commit them.                                                        |

Frontend environment variables are embedded at build time. Restart Vite after changing them and rebuild after changing production values. Backend variables are read at process startup; restart the API after changes.

## Development Demo Accounts

These are in-memory frontend demos, not database accounts and not valid local credentials:

| Email                   | Password     | Demo role            |
| ----------------------- | ------------ | -------------------- |
| `admin@hulma.com`       | `admin123`   | System Administrator |
| `marco.reyes@hulma.com` | `fleet123`   | Fleet Manager        |
| `sandra.cruz@hulma.com` | `finance123` | Finance Manager      |
| `jose.lim@hulma.com`    | `procure123` | Procurement Officer  |
| `ana.santos@hulma.com`  | `request123` | Department Requester |

To exercise the demo UI, run Vite in development mode with `VITE_ENABLE_DEV_AUTH_HEADERS=true`. Simulated API requests also require backend `ALLOW_DEV_AUTH_HEADERS=true` and a non-production `NODE_ENV`. Restart both processes after setting the flags. The backend migration separately seeds `superadmin@hulma.com`, `fleet.manager@hulma.com`, `logistics@hulma.com`, and `driver1@hulma.com` as Fleet user records, but it seeds **no passwords or auth identities** for them. Do not use the demo passwords outside local development.

## Verification And Remaining Work

In `NODE_ENV=development` or `test`, signup does not attempt SMTP and returns a one-time verification URL for local testing. The URL is exposed only outside production. Production signup requires configured SMTP and returns an error if verification mail cannot be sent.

Verification snapshot for 2026-10-05: backend TypeScript build and 33 tests passed; frontend typecheck, 28 tests, targeted lint, and production build passed. Integration coverage includes dynamic signup options, pending-login denial, approval/rejection history, Department LOV head assignment and identity enforcement in legacy/versioned TSRF, and persistent audit writes. Focused coverage remains needed for real SMTP delivery, reset/CSRF behavior, Entra JWKS/role/link verification, and bootstrap repeat-run behavior; real Entra/SMTP round trips have not been exercised.
Before production enablement:

1. Run the one-time bootstrap securely and remove its environment inputs after confirming admin login.
2. Configure Entra app registrations, API scope, role claims/map, production session secret, database, exact frontend origin, HTTPS, and SMTP for signup/reset delivery.
3. Add focused tests for local lifecycle and CSRF/reset behavior, Entra identity and role checks, frontend signup/approval, and development-demo gating.
4. Confirm production rate limiting and operational audit retention.

The owner-scoped returned-TSRF inbox and edit/resubmit workflow is implemented. Production rollout still depends on the deployment prerequisites above. See [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) for the current project phase summary.
