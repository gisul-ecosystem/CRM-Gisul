# LinkedIn scraper

The LinkedIn section of the CRM (`/[slug]/linkedin/*`) is the front end of the
**LinkedIn scraper**, a separate service in `services/linkedin-scraper`, with its
own MongoDB, Chromium browser and Docker image (`gisuldocker/linkedin-scrapper`).
The CRM never reads or writes the scraper's database. It only shows the scraper's
screens and talks to its API.

- **It is not a workspace.** `bun install`, turbo, Biome, oxlint and knip skip
  `services/`. It uses npm and CommonJS, and its `npm install` downloads Chromium.
- **Its code came from the `linkedIn-Scrapper` repository.** One change: the
  hardcoded Atlas backup address is gone, so the hourly Atlas backup runs only
  when `MONGODB_ATLAS_URI` is set.

## What it does

1. **Connect LinkedIn.** Someone signs in to LinkedIn once, in the scraper's
   browser. Every CRM user then shares that one LinkedIn account.
2. **Search and scrape.** A LinkedIn search, one profile, or a CSV/Excel file of
   profile links. The scraper reads each profile.
3. **Draft.** For each person, an AI (Claude or OpenAI, set in the scraper) picks a
   Gisul product and writes a message from `knowledge/*.md`. A person under the
   match threshold gets no draft.
4. **Queue.** People review, edit, skip or clear drafts.
5. **Send.** The scraper types and sends each message on LinkedIn: at most
   `DAILY_SEND_LIMIT` a day, in batches with a pause between them.

## How a request travels

```
browser ──► CRM app /api/linkedin-scraper/<path>   (apps/app/app/api/linkedin-scraper/[...path]/route.ts)
              1. Better Auth session, or 401
              ▼
            LinkedIn scraper /api/<path>
```

- **Every signed-in CRM user has full access.** There is no role check: members
  can scrape, edit drafts and send.
- **The scraper has no login of its own.** The CRM session is the only gate. Keep
  the scraper's port on a private network that only the CRM reaches.
- **The browser never calls the scraper.** `LINKEDIN_SCRAPER_URL` is server-side
  only. The proxy strips the browser's cookies and `Authorization`, and drops
  `set-cookie` on the way back.
- **Path guard**: `upstreamPath` only maps `/api/linkedin-scraper/…` and refuses
  `.` or `..` segments.
- **Missing configuration never throws.** Without `LINKEDIN_SCRAPER_URL` the proxy
  answers `503 SCRAPER_NOT_CONFIGURED` and every LinkedIn page says so.

## The sign-in browser

- **Scraper outside Docker:** a Chromium window opens on the scraper's computer.
  Sign in there.
- **Scraper in Docker:** Chromium runs inside the container, and noVNC on port
  6080 shows it. Set `LINKEDIN_SCRAPER_VIEWER_URL` to the public address of the
  scraper's web port, and the overview shows an "Open browser viewer" link. The
  viewer has no password: put it behind your own login.
- **Sign in with email and password, not Google.** "Back to LinkedIn" moves a
  browser stuck on Google's sign-in back to LinkedIn.

## Where the code lives

| Concern | File |
| --- | --- |
| Scraper URL, viewer URL, path guard | `apps/app/lib/linkedin-scraper/bridge.ts` |
| Tunable numbers | `apps/app/lib/linkedin-scraper/scraper-config.ts` |
| Response schemas, parsed once | `apps/app/lib/linkedin-scraper/schemas.ts` |
| One function per endpoint | `apps/app/lib/linkedin-scraper/api.ts` |
| Query keys and invalidation | `apps/app/lib/linkedin-scraper/cache.ts` (`useScraperCache`) |
| Status polling | `apps/app/lib/linkedin-scraper/use-status.ts` |
| Shared components | `apps/app/components/linkedin-scraper/*` |
| Screens | `apps/app/app/(app)/[slug]/linkedin/*` |

- **Every response is parsed with Zod at the boundary.** A shape the schema does
  not expect is an `UNEXPECTED_SHAPE` error. Older profile documents miss fields,
  so text fields default to `""` and an unknown `queueStatus` reads as `scraped`.
- **Status polls every 3 s while a job runs, and every 30 s otherwise.** The
  scraper keeps job progress in memory, so a scraper restart loses the live log.

## Screens

| CRM page | Scraper endpoints |
| --- | --- |
| Overview | `/status`, `/products`, `/rag/rebuild`, `/linkedin/*` |
| Search and scrape | `/connection-types`, `/scrape/start`, `/scrape/import`, `/jobs` |
| Profiles | `/results`, `/results/download` |
| Queue | `/queue`, `/queue/:slug`, `/queue/skip`, `/queue/clear`, `/queue/send` |
| Sent | `/reports/daily-sends/summary`, `/reports/daily-sends` |

## Running it

Both compose files start the scraper as `linkedin-mongo` and `linkedin-scraper`,
under the `linkedin` profile: `COMPOSE_PROFILES=outreach,linkedin` in `.env`, or
`docker compose --profile linkedin up -d`.

- **The scraper reads `./linkedin-scraper.env`, not the CRM's `.env`.** Put
  `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) there, and the sending limits.
- **`MONGODB_URI` is always the `linkedin-mongo` container.** Compose sets it.
- **`linkedin-scraper` listens on `127.0.0.1:6363` and `127.0.0.1:6080`.** The
  CRM reaches it as `http://linkedin-scraper:6363` inside Docker.
- **The Atlas backup is off unless `MONGODB_ATLAS_URI` is set** in
  `linkedin-scraper.env`.
- **`LINKEDIN_SCRAPER_IMAGE` picks the image.** `docker-compose.yml` can also
  build it from `services/linkedin-scraper`: `docker compose --profile linkedin
  build linkedin-scraper`. `docker-publish.yml` and `docker-publish-dev.yml` publish it with
  the CRM images and the same tags.

Locally, without Docker:

```sh
cd services/linkedin-scraper
npm install                # also downloads Chromium
copy .env.example .env     # set MONGODB_URI and ANTHROPIC_API_KEY
npm start                  # http://localhost:6363
```

and set `LINKEDIN_SCRAPER_URL="http://127.0.0.1:6363"` in the CRM's `.env`.
