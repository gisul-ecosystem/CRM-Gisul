# Lead generation pipeline

The Lead generation section of the CRM (`/[slug]/lead-generation/*`) is the front
end of the **lead generation pipeline**, a separate Python service in
`services/leads-pipeline`, with its own Docker image
(`gisuldocker/leads-pipeline`). The CRM never reads the pipeline's files. It only
shows the pipeline's screens and talks to its API.

- **It is not a workspace.** `bun install`, turbo, Biome, oxlint and knip skip
  `services/`. It uses Python 3.12 and `requirements.txt`.
- **Its code came from the `leads-pipeline` project.** Only the `leads/` package
  and its build files came over. Three changes:
  - The email sender (`outreach.py`, the `outreach` command and its settings) is
    gone. Send mail from the Outreach section of the CRM.
  - `leads/web.py` is a JSON API. The old HTML page, its password and the
    tracked links are gone.
  - Tests, docs, sample data and `setup_server.sh` stayed behind.

## What it does

```
discover -> scrape -> people -> emails -> verify -> score -> leads.xlsx
```

1. **Discover.** Finds companies from public sources: seed lists, incubator and
   VC portfolios, web search, Google Maps, funding news, GitHub, Hugging Face and
   Hacker News.
2. **Scrape.** Reads each company's website for people, emails and phones.
3. **Verify.** Checks each email with an MX lookup, and with Reacher when it runs.
4. **Score.** A lead at or above `MIN_SCORE` is `ready=yes`.

There are three **profiles**, each with its own data, settings and sources:
`gpu` (GPU leads), `training` (training-lab leads) and `competitors` (competitor
clients). Every screen has a tab per profile; `?profile=` keeps the choice in the
URL.

## How a request travels

```
browser ──► CRM app /api/leads-pipeline/<path>   (apps/app/app/api/leads-pipeline/[...path]/route.ts)
              1. Better Auth session, or 401
              ▼
            leads pipeline /api/<path>
```

- **Every signed-in CRM user has full access.** Members can start runs and change
  settings and API keys.
- **The pipeline has no login of its own.** The CRM session is the only gate. Keep
  its port on a private network that only the CRM reaches. Outside Docker it
  refuses to listen on anything but localhost.
- **The browser never calls the pipeline.** `LEADS_PIPELINE_URL` is server-side
  only. The proxy strips cookies, `Authorization`, `Origin` and `Referer`, and
  drops `set-cookie` on the way back.
- **Missing configuration never throws.** Without `LEADS_PIPELINE_URL` the proxy
  answers `503 PIPELINE_NOT_CONFIGURED` and every Lead generation page says so.

## Where the code lives

| Concern | File |
| --- | --- |
| Pipeline URL, path guard | `apps/app/lib/leads-pipeline/bridge.ts` |
| Tunable numbers | `apps/app/lib/leads-pipeline/pipeline-config.ts` |
| Response schemas, parsed once | `apps/app/lib/leads-pipeline/schemas.ts` |
| One function per endpoint | `apps/app/lib/leads-pipeline/api.ts` |
| Query keys and invalidation | `apps/app/lib/leads-pipeline/cache.ts` |
| Status polling, profile in the URL | `apps/app/lib/leads-pipeline/use-status.ts` |
| Shared components | `apps/app/components/leads-pipeline/*` |
| Screens | `apps/app/app/(app)/[slug]/lead-generation/*` |
| The API | `services/leads-pipeline/leads/web.py` |

- **Status polls every 5 s while a run is in progress, and every 30 s otherwise.**
- **The API reads `leads.xlsx` again only when the file changes.**

## Screens

| CRM page | Pipeline endpoints |
| --- | --- |
| Overview | `/status`, `/run`, `/stop`, `/log` |
| Leads | `/leads`, `/download` |
| Settings | `/settings` (GET and POST) |
| Custom search | `/custom-search` (GET and POST), `/custom-search/preview`, `/log` |

- **Leads become CRM contacts by selection.** Tick rows on the Leads page (the
  header box ticks the page; the choice survives paging) and click **Add to CRM
  contacts**, after picking a lead source (default Cold outreach). The app calls `contacts.importLeads` with the lead's name, email,
  phone, title, company and domain, at most 200 at a time
  (`LEADS_PIPELINE.addToCrm`, `CONTACT_IO.leads`). Each contact gets lead status
  New and the chosen lead source. The company is found by domain or created
  with the lead's company name (`CompanyDirectoryService.companyForDomain`); an
  existing company is never renamed, and a free-mail domain makes no company. A
  person already in the CRM (same email, or same name at the same company) is
  counted as existing and left unchanged. A row without a person name cannot be
  ticked.
- **Custom search finds companies from your own description.** The page takes a
  name, what to find (one kind per line), where (one place per line), words a
  result must mention or must not mention, and how many companies. Each line of
  What is searched in each place: at most 30 searches and 200 companies per run
  (`CUSTOM_SEARCH` in `leads/custom_search.py`). Preview shows the searches
  before a run.
- **It searches with an API key when one is set, else in its own browser.**
  With `SERPER_API_KEY`, `TAVILY_API_KEY` or `BRAVE_API_KEY` it uses that API.
  Without one, the `custom` source (`leads/sources/custom.py`) opens Chromium
  through Playwright: DuckDuckGo's HTML page first, Bing second. It waits 4 to 9
  seconds between searches. A CAPTCHA, an error page or results unrelated to
  the query count as blocked: no junk company is saved.
- **The browser is visible in a viewer, like the LinkedIn scraper's.** The image
  runs Xvfb, fluxbox, x11vnc and noVNC (`docker-entrypoint.sh`, container port
  6080, host `127.0.0.1:6082`). With a screen, the search Chromium opens as a
  normal window and keeps its cookies in the data volume (`search-browser/`).
  When an engine shows a check, the run waits up to 5 minutes
  (`CUSTOM_SEARCH.check_wait_seconds`) for a person to solve it in the viewer,
  then goes on. Headless Chromium is blocked by both engines; the
  visible one is not, in our test. Daily runs stay headless.
- **The Custom search page embeds the viewer while a search runs.** Set
  `LEADS_PIPELINE_VIEWER_URL` on the app; the server page builds the noVNC
  address with its own WebSocket path, so it does not collide with the
  LinkedIn viewer's `/websockify`. Route it through the reverse proxy and reuse
  the CRM session check:

  ```nginx
  location /leads-viewer/ {
      auth_request /_linkedin_viewer_auth;
      proxy_pass http://127.0.0.1:6082/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_read_timeout 3600s;
  }
  ```

  with `LEADS_PIPELINE_VIEWER_URL="https://<crm-domain>/leads-viewer"`. The
  `/_linkedin_viewer_auth` location is the one from docs/linkedin-scraper.md.
- **The rest of the run is the normal pipeline** under the chosen profile: the
  website check, segments, countries, people, emails, verification and scores
  from that profile's Settings. Daily runs never use the `custom` source.
- **Each search tags its leads.** The source column gets `custom-<name>`. The
  Leads page has a Search filter (`?source=` in the URL), and View leads on a
  past search opens it. The search and its history live in the profile's data
  folder: `custom_search.json` and `custom_searches.json`.
- **Stop works only for a run started from the CRM.** The daily run belongs to the
  scheduler, so the Stop button stays disabled for it.

## Running it

Both compose files start it as `leads-pipeline` and `leads-reacher`, under the
`leads` profile: add `leads` to `COMPOSE_PROFILES` in `.env`, or
`docker compose --profile leads up -d`.

- **Settings live in the `leads-data` volume**, not in the CRM's `.env`:
  `/app/data/.env` for `gpu`, and `/app/data/.env.training` and
  `/app/data/.env.competitors` for the other profiles. The first start writes
  each missing file from its example, with `RUN_AT=02:00` and Reacher at
  `http://leads-reacher:8080`. Change them on the Settings page.
- **Set `USER_AGENT` first.** Websites see it on every request. Put a real
  contact address in it.
- **`leads-pipeline` listens on `127.0.0.1:8502`** on the host. The CRM reaches it
  as `http://leads-pipeline:8501` inside Docker.
- **Reacher needs outbound port 25.** Most cloud servers block it. Without it,
  emails get only the MX check. Set `LEADS_REACHER_HELLO_NAME` and
  `LEADS_REACHER_FROM_EMAIL` to your own domain; nothing is sent from them.
- **The image follows `CRM_IMAGE_TAG`.** `docker-publish.yml` and
  `docker-publish-dev.yml` publish `gisuldocker/leads-pipeline` with the CRM
  images and the same tags. `LEADS_PIPELINE_IMAGE` overrides it.
  `docker-compose.yml` can also build it:
  `docker compose --profile leads build leads-pipeline`.
- **Reacher is pinned** to `reacherhq/backend:v0.11.8`. A new release can change
  its answers and silently stop email checks. Test a new version, then set
  `LEADS_REACHER_IMAGE`.
- **It runs as the user `leads` (uid 10001), not root.** A fresh `leads-data`
  volume takes that owner from the image. A volume made by an older, root image
  needs one fix: `docker compose -f docker-compose.prod.yml run --rm --user root
  --entrypoint chown leads-pipeline -R 10001:10001 /app/data`.
- **CI checks it.** The `leads-pipeline` job in `ci.yml` installs
  `requirements.txt`, compiles `leads/`, imports the API and checks the
  entrypoint.

### Production rollout

On the server, in the directory with `docker-compose.prod.yml`:

1. Add `leads` to `COMPOSE_PROFILES` in `.env`.
2. Set `LEADS_REACHER_HELLO_NAME` and `LEADS_REACHER_FROM_EMAIL` in `.env`.
3. `docker compose -f docker-compose.prod.yml pull leads-pipeline leads-reacher app`
4. `docker compose -f docker-compose.prod.yml up -d leads-reacher leads-pipeline app`
5. Open Lead generation, Settings, and set `USER_AGENT` and the API keys.

The app needs no `LEADS_PIPELINE_URL` in production: the compose file sets it.

### Locally, without Docker

```sh
cd services/leads-pipeline
python -m venv .venv
.venv\Scripts\activate            # Windows; source .venv/bin/activate elsewhere
pip install -r requirements.txt
python -m playwright install chromium
copy .env.example .env            # set USER_AGENT
python -m leads.web               # http://127.0.0.1:8501
```

and set `LEADS_PIPELINE_URL="http://127.0.0.1:8501"` in the CRM's `.env`.
