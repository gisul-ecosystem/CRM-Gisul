# Outreach

The Outreach section of the CRM (`/[slug]/outreach/*`) is the front end of the
**Outreach Engine**, a separate service with its own repository, MongoDB, worker
and Docker image (`gisuldocker/outreach-engine`). The CRM never reads or writes
the engine's database. It only shows the engine's screens and talks to its API.
The engine's code is not changed for the CRM.

## How a request travels

```
browser ──► CRM app /api/outreach/<path>          (apps/app/app/api/outreach/[...path]/route.ts)
              1. Better Auth session, or 401
              2. a change to providers, domains or inboxes needs a CRM owner or admin, or 403
              3. the engine session cookie, cached in memory; logs in again on a 401
              ▼
            Outreach Engine /api/<path>  with  Cookie: outreach_session=<…>
```

- **The CRM signs in with the engine's own login** (`POST /api/auth/login`) as one
  service account: `OUTREACH_EMAIL` and `OUTREACH_PASSWORD`. Use an engine admin,
  such as its `ADMIN_EMAIL`.
- **Every CRM user acts as that one account inside the engine.** The engine's
  activity log does not show which CRM user did what.
- **The CRM enforces the roles.** `adminOnly` (`apps/app/lib/outreach/bridge.ts`)
  refuses members any change to providers, domains or inboxes, and the mailbox
  directory listing. Sending setup shows read-only to them.
- **The browser never calls the engine.** `OUTREACH_URL` is server-side only. The
  engine's API and login page must not be reachable from the internet. Only its
  tracking links (`/r/<token>`) must be public.
- **Cookies do not cross.** The proxy strips the browser's cookies and
  `Authorization`, sends only the engine cookie, and drops `set-cookie` on the way
  back.
- **Path guard**: `enginePath` only maps `/api/outreach/…` and refuses `.` or `..`
  segments.
- **Missing configuration never throws.** Without all of `OUTREACH_URL`,
  `OUTREACH_EMAIL` and `OUTREACH_PASSWORD` the proxy answers
  `503 OUTREACH_NOT_CONFIGURED` and every Outreach page says so.

## Where the code lives

| Concern | File |
| --- | --- |
| Engine login, URL, path guard, admin-only rule | `apps/app/lib/outreach/bridge.ts` |
| Tunable numbers | `apps/app/lib/outreach/outreach-config.ts`, `campaign-rules.ts` |
| Response schemas, parsed once | `apps/app/lib/outreach/schemas/*.ts` |
| One function per endpoint | `apps/app/lib/outreach/api.ts` |
| Query keys and invalidation | `apps/app/lib/outreach/cache.ts` (`useOutreachCache`) |
| Labels and tones per status | `apps/app/lib/outreach/labels.ts` |
| Shared Outreach components | `apps/app/components/outreach/*` |
| Screens | `apps/app/app/(app)/[slug]/outreach/*` |

- **Every response is parsed with Zod at the boundary.** `outreachData` reads the
  engine's `{ data }` envelope, `outreachPage` reads `{ data, page, limit, total }`.
  A shape the schema does not expect is an `UNEXPECTED_SHAPE` error, never a silent
  `undefined`. When the engine changes a DTO, change the schema in the same release.
- **Readiness rules live in the engine only.** The wizard saves the email a moment
  after typing stops and asks the engine for `GET /campaigns/:id/readiness`. The
  CRM keeps only `applyFix`, the helper behind the "Add it" buttons.

## Screens

| CRM page | Engine endpoints |
| --- | --- |
| Overview | `/dashboard/*` |
| Campaigns, campaign page, wizard | `/campaigns/*` |
| Audiences: contacts, lists, suppressions, CSV import, tracking links | `/contacts/*`, `/lists/*`, `/suppressions/*`, `/tracking/config` |
| Sent: sent emails, link clicks | `/sent-emails/*`, `/tracking/clicks` |
| Replies | `/incoming-emails/*` |
| Sending setup: inboxes, domains, providers | `/inboxes/*`, `/domains/*`, `/providers/*` |

## Running it

Both compose files start the engine as `outreach-mongo`, `outreach-setup`,
`outreach-web` and `outreach-worker`, under the `outreach` profile. They do not
start unless the profile is on: `COMPOSE_PROFILES=outreach` in `.env`, or
`docker compose --profile outreach up -d`.

- **The engine reads `./outreach.env`, not the CRM's `.env`.** Its variable names
  (`APP_URL`, `JWT_SECRET`, `MONGODB_URI`) collide with the CRM's. Copy the
  engine's `.env.example` to `outreach.env`.
- **`MONGODB_URI` is always the `outreach-mongo` container.** Compose sets it, so
  the value in `outreach.env` is ignored.
- **The CRM's `OUTREACH_EMAIL` and `OUTREACH_PASSWORD` are the engine's
  `ADMIN_EMAIL` and `ADMIN_PASSWORD`.** `outreach-setup` creates that admin.
- **`docker-compose.prod.yml` sets the app's `OUTREACH_URL` to
  `http://outreach-web:3000`.** The value in `.env` is for a CRM run outside
  Docker.
- **`outreach-web` listens on `127.0.0.1:3020`.** Point the tracking domain (for
  example `go.racko.ai`) at it through the reverse proxy, and expose only `/r/`.
- **`DRY_RUN=true` in `outreach.env` sends nothing.** Live sending needs
  `DRY_RUN=false` and `SENDING_ENABLED=true`.
- **`OUTREACH_IMAGE_TAG` picks the engine image.** The engine's own repository
  builds and publishes it, not this one.

Outreach and the CRM can both read Microsoft mailboxes. Use dedicated sending
mailboxes that reps do not connect to the CRM, or the same email is stored in
both systems.
