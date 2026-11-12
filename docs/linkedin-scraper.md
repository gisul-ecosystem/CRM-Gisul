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
  scraper's web port, and the overview shows an "Open browser viewer" link.
  The CRM adds `/vnc/vnc_lite.html`, and the scraper proxies it to noVNC.
- **Embedded viewer.** While Connect LinkedIn runs, the overview shows the
  viewer in the page. That needs the viewer on the CRM's own origin: an `http`
  viewer inside an `https` CRM is blocked. Route it through the reverse proxy,
  and let the proxy ask `GET /api/linkedin-viewer/auth` first (`204` signed in,
  `401` not). noVNC opens its WebSocket at `/websockify` on the same host.
  Set `LINKEDIN_SCRAPER_VIEWER_URL="https://<crm-domain>/linkedin-viewer"`.

  ```nginx
  location = /_linkedin_viewer_auth {
      internal;
      proxy_pass http://127.0.0.1:3010/api/linkedin-viewer/auth;
      proxy_pass_request_body off;
      proxy_set_header Content-Length "";
      proxy_set_header Host $host;
      proxy_set_header Cookie $http_cookie;
  }
  location /linkedin-viewer/vnc/ {
      auth_request /_linkedin_viewer_auth;
      proxy_pass http://127.0.0.1:6364/vnc/;
  }
  location /websockify {
      auth_request /_linkedin_viewer_auth;
      proxy_pass http://127.0.0.1:6364;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 3600s;
  }
  ```

  Only `/vnc/` and `/websockify` pass through. The scraper's `/api/*` stays
  private. The
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
| Search and scrape | `/connection-types`, `/scrape/start`, `/scrape/posts`, `/scrape/import`, `/scrape/stop`, `/jobs` |
| Found posts | `/results`, filtered to profiles with `sourcePost` |
| Profiles | `/results`, `/results/download` |
| Queue | `/queue`, `/queue/:slug`, `/queue/template`, `/queue/skip`, `/queue/clear`, `/queue/send` |
| Sent | `/reports/daily-sends/summary`, `/reports/daily-sends` |

- **Auto-send is a switch on the LinkedIn search tab, off by default.** On, each
  matching person is messaged right after the draft, within `DAILY_SEND_LIMIT`,
  and the run stops at the limit. It works only for 1st-degree searches, with
  AI drafts on and no single profile: LinkedIn blocks messages to people who
  are not connections. The scraper answers `400` to any other auto-send request.
  Posts and file imports never send.
- **Posts finds people by what they post.** One keyword search of LinkedIn
  posts per run, newest first, limited to the last 24 hours, week or month: 10
  posts by default and 25 at most (`POST_SEARCH` in
  `services/linkedin-scraper/src/config.js`). The AI reads each post first and
  keeps only authors who show a need, with a score of at least 60. Only those
  profiles are opened, so LinkedIn sees few page views. The draft uses the post
  as its hook. The post is stored on the profile as `sourcePost`, and the
  profile sheet shows it under "Found from a post". Post runs never send:
  drafts go to the Queue. Without an AI key, every post author is kept.
- **Post search is paced for account safety.** One run per day by default
  (`POST_SEARCH_DAILY_RUNS` in `linkedin-scraper.env`); a second run gets
  `429`. Each run first scrolls the feed, then waits a random 4 to 9 seconds
  between scrolls and 25 to 60 seconds between profile visits. A new account
  that signs in from a server IP still gets restricted fast: use an older
  account.
- **Post search reads LinkedIn's page markup.** It finds a post by its post ID,
  or, on pages without IDs, by one author link plus the post's own Like button
  (next to Comment and Repost). Without a post ID, "Open the post" opens the
  author's recent activity. A run with 0 posts logs a page check line and saves
  `post-search-debug.png` and `post-search-debug.html` in the output volume.
- **Found posts lists every person found from a post,** newest first, with the
  post, need score and product. A click opens the profile sheet with the draft.
- **Message: an AI draft for each person, or one template for everyone.** Every
  scrape tab has a Message choice: AI draft, same template, or no message. A
  template (typed, or a .txt file uploaded into the box) takes the placeholders
  `{{firstName}}`, `{{name}}`, `{{company}}`, `{{title}}` and `{{location}}`,
  filled from each profile, with a neutral word when a value is missing
  (`MESSAGE_TEMPLATE` in `src/config.js`, `src/message-template.js`). An unknown
  placeholder is a `400`. With the AI fit check on, the AI still skips people
  who do not fit and the rest get the template; off, everyone is queued with it.
  Auto-send sends the template too. On the Queue, "Use one template" replaces
  the selected drafts, or every queued draft, through `POST /api/queue/template`.
- **Stop and save stops a running scrape.** The scraper finishes the profile in
  progress, saves it, writes the Excel export and ends the job as `stopped`.
  Every profile scraped before the stop stays saved. A batch pause during
  auto-send ends at once. A send started from the Queue page does not stop.
- **The stop needs a scraper image with `POST /api/scrape/stop`.** An older
  image answers 404, and the button shows that error.

## Running it

Both compose files start the scraper as `linkedin-mongo` and `linkedin-scraper`,
under the `linkedin` profile: `COMPOSE_PROFILES=outreach,linkedin` in `.env`, or
`docker compose --profile linkedin up -d`.

- **The scraper reads `./linkedin-scraper.env`, not the CRM's `.env`.** Put
  `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`) there, and the sending limits.
- **`MONGODB_URI` is always the `linkedin-mongo` container.** Compose sets it.
- **`linkedin-scraper` listens on `127.0.0.1:6363` and `127.0.0.1:6080`.** In
  `docker-compose.prod.yml` the host ports are `6364` and `6081`, because a separate
  scraper already holds 6363 and 6080 on the production server. The
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
