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

## One Lead generation section

The LinkedIn scraper and the lead pipeline share one menu group, **Leads & LinkedIn**
(`/[slug]/lead-generation/*`). Each page is a set of tabs; the tab is the `view`
query parameter. Each tab shows its source: a LinkedIn logo or a globe (`source` on a tab). Routes and tab names live in `apps/app/lib/lead-hub/lead-hub-config.ts`,
and `components/lead-hub/lead-hub-page.tsx` draws the page.

| Menu item | Tabs (`?view=`) |
| --- | --- |
| Overview `/lead-generation` | Website pipeline (`website`) · LinkedIn (`linkedin`) |
| Find leads `/lead-generation/find` | Website search (`website`) · LinkedIn search (`linkedin`) · Partner research (`partners`) |
| Leads `/lead-generation/leads` | Website leads (`website`) · LinkedIn profiles (`profiles`) · Found posts (`posts`) · LinkedIn companies (`companies`) |
| Messages `/lead-generation/messages` | LinkedIn queue (`queue`) · LinkedIn sent (`sent`) |
| Settings `/lead-generation/settings` | Website pipeline settings |

Each screen exports a panel (`LeadsPanel`, `ScrapePanel`, …) wrapped in a gate:
`PipelineGate` (pipeline unreachable, profile tabs) or `ScraperGate` (scraper
unreachable). The view files stay in their old folders. Every old address
(`/linkedin`, `/linkedin/*`, `/lead-generation/search`) redirects to its new page and tab.

## Screens

| CRM page | Pipeline endpoints |
| --- | --- |
| Overview | `/status`, `/run`, `/stop`, `/log` |
| Leads | `/leads`, `/download` |
| Settings | `/settings` (GET and POST) |
| Custom search | `/custom-search` (GET and POST), `/custom-search/preview`, `/log` |
| Partner research | `/partners` (GET and POST), `/partners/preview`, `/partners/results`, `/partners/log`, `/partners/stop` |

- **Leads sort in the pipeline, not the browser.** `/leads` and `/download` take
  `sort`: `score` (default, best first), `company` (A to Z, the domain when the
  name is empty), `newest` or `oldest` (by date found). The Leads page has a
  Sort select and a Found column.
- **Countries can be picked per run.** Start a run and Custom search send
  `countries`; the run gets them as its own `COUNTRIES` and Settings keeps the
  default. `/status` reports `countryOptions` and the saved `targetCountries`.
- **Reviewers reject leads from the Leads page.** `POST /leads/reject` with
  `scope` `person` (drops those rows and remembers domain + person in
  `state.json` `rejected_people`; `Store.save` drops them again, so a later run
  cannot bring them back) or `company` (drops every row and adds the domain to
  `rejected`, which discovery skips). It answers `409` while a run is going.
  "Select no valid email (this page)" ticks rows with no email or one not
  verified valid.
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
- **A LinkedIn URL on the lead goes onto the contact.** `importLeads` also takes
  `linkedinUrl`. A new contact stores it. An existing contact gets it only when
  its own LinkedIn URL is empty. Either way the API queues an agent `identify`
  task that says a LinkedIn profile is on file. The agent reads the profile
  (Context.dev, then Unifers `people/enrich/linkedin`) and fills a missing work
  email and mobile with `reveal_contact_details` (Unifers `people/reveal/linkedin`).
  The API calls no vendor: see `docs/agent.md` → Unifers. Without
  `UNIFERS_API_KEY` the agent skips the Unifers steps.
- **A lead already in the CRM shows "In CRM"** under the person's name. The page
  asks `contacts.matchLeads` for its rows, with the same rule as the import: same
  email, or, with no email, same name at the company with that domain. It changes
  after Add to CRM contacts, because `listKeys()` in `lib/trpc/cache.ts` includes it.
- **The Contacts table names the profile in Source**: `Cold outreach (GPU lead)`,
  `(Training lab lead)` or `(Competitor client)`. `contacts.list` reads it from the
  contact's first `lead_origin` note, the same note the contact sheet's Lead type
  reads.
- **Custom search finds companies from your own description.** The page takes a
  name, what to find (one kind per line), where (one place per line), words a
  result must mention or must not mention, and how many companies. Each line of
  What is searched in each place: at most 30 searches and 200 companies per run
  (`CUSTOM_SEARCH` in `leads/custom_search.py`). Preview shows the searches
  before a run.
- **Search with: Google in the search browser (default), or the search API.**
  Browser: Chromium opens google.com, types the search in the box, reads up to 2
  result pages (title, link, summary), then DuckDuckGo and Bing as fallbacks,
  then the search API. API: Serper (Google results), then Tavily, then the
  browser. Google shows "I'm not a robot" to an automated browser at once; a
  person ticks it in the viewer. It waits 4 to 9 seconds between searches. A
  check nobody solves, an error page or unrelated results count as blocked: no
  junk company is saved.
- **Some websites are never returned:** any domain written in the search ("like
  racko.ai" skips racko.ai), our own products (Racko, KanonKode, Aaptor, Gisul)
  and listing or review sites such as G2, Capterra, Clutch and SourceForge
  (`own_domains`, `listing_domains` in `CUSTOM_SEARCH`).
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

## Countries

Every lead generation pipeline (GPU, Training, Competitor clients and Partner research) offers the
same 10 countries: India, Malaysia, Singapore, Thailand, Indonesia, United Arab Emirates, Saudi
Arabia, Qatar, Australia and United States. Each pipeline keeps its own default selection.

`leads/geo.py` (`COUNTRIES`) holds them for the GPU, Training and Competitor profiles. Each has its
domain ending, phone code, cities, places (English and Arabic for the Gulf) and
company-registration markers (FZ-LLC, DMCC, a Saudi C.R. number, QFC, an Australian ABN or Pty
Ltd, a US EIN or Delaware corporation). `GULF` is United Arab Emirates, Saudi Arabia and Qatar.
Pick them in the Countries choice of a run. Search, Maps and Custom search then query their
cities, and the country check reads `.ae`, `+971` and the other markers.

`GULF_SKIP` in `sources/search.py` drops Gulf job boards, news sites and directories;
`AU_US_SKIP` does the same for Australia and the United States. The GPU
profile also reads two Gulf incubators in `incubators.csv`: in5 (plain HTML) and Hub71 (needs
`RENDER_JS=1`). Both use `india=check`, so each startup's own site decides its country.

The training profile reads the AI CERTs training-partner list in `training_directories.csv`
(about 300 partners, 14 with a Gulf domain ending). Partners outside the chosen countries are dropped.

Arabic pages pass the same checks. `training.py` and the AI words in `geo.py` hold Arabic terms
beside the English ones. The Arabic terms take no word boundaries, because Arabic joins "the" and
"and" to the word (والتدريب).

More countries do not spend more search credits in one run. Search stops at its per-run budget and
skips queries done before, so each run continues the list.

## Date filter

The Leads page has **Found from** and **Found to**. They send `since` and `until` (`YYYY-MM-DD`)
to `/api/leads` and `/api/download`. Both days are included. The filter reads `date_found`, the
day the pipeline first found the lead. A value that is not a date is ignored.

## Emails for Gulf (and other) companies

- **Other domains.** An address on a sibling domain counts as the company's (`info@acme.com` for
  `acme.ae`), after its own domain. A free mailbox (Gmail, Hotmail, Outlook, Yahoo) is used only when
  the site shows nothing on the company's domains; its source is `website-freemail`. Each address
  is verified against its own mail domain.
- **People search** uses the first search key set: Serper, Tavily, then Brave. It searches in the
  company's country (Brave: `ALL` where it has no country), and moves to the next key when one
  is out of credit. It searches up to `SEARCH_MAX_PER_RUN` companies a run.
- **General Manager** counts as a decision-maker title in both profiles.
- **One more pass.** `EMAIL_RULES_VERSION` in `stages.py` gives companies left without an email one
  more pass when the rules change, if their site shows an address the new rules accept. Companies
  searched for people with the old India-only search are searched once more in their own country.

## Competitor clients: who and what

Each competitor client has `competitor` (the provider whose case study or testimonial named it)
and `competitor_service` (what it buys there, up to three: GPU cloud by GPU model, AI model
training, inference, bare metal, VMs, Kubernetes, HPC, storage, colocation, managed cloud,
backup, CDN, databases). `leads/competitor_info.py` holds the words. The service is read from
the case study page, or from the text around a client link on a testimonials page. Rows from
before these columns get the provider from `source_ref` and the service from the saved quote
when the sheet loads. The Leads page shows Competitor and "Service they take" in place of
Segment for the competitors profile.

A competitor client's company name is its domain (`name_from_domain`: `wafer.ai` is "Wafer"),
never the link text. Link text on a testimonials page is "Visit Wafer", "Discord" or a sales
banner. `name_competitor_clients` in `leads/store.py` renames saved rows when the sheet loads.

Old clients whose service is still empty are filled by the next competitors run:
`backfill_services` reads each saved `signal_url` again (`SERVICE_BACKFILL_PAGES` pages per run,
each page once) and tries each company once.


## Competitor clients: found by search

The competitors run does not rely only on `leads/competitors.csv`. With a search key (Serper,
Tavily or Brave) and `SEARCH_DISCOVERY_PER_RUN` above 0 on the Competitor clients tab, each run
also searches. `leads/sources/competitor_search.py` holds every number and word list
(`COMPETITOR_SEARCH`).

1. **New providers.** It searches "GPU cloud provider <country>", "rent H100 GPU cloud
   <country>" and the other `provider_topics`, plus "alternatives to <provider> GPU cloud" for
   listed providers. A result counts as a provider when its home page shows at least 3 GPU-cloud
   words (H100, bare metal, per hour, GPU instances...). It finds the provider's customers or
   case-studies page from the home page links. Found providers go into `state.json`
   (`competitor_providers_found`) and are crawled like the CSV ones from then on. A site that fails
   the check is remembered and not checked again. At most 10 new providers a run, 80 in all.
2. **More case studies.** For every provider it searches `site:<domain> "case study"`, and reads
   the case studies the testimonials page does not link.
3. **Clients that name the provider.** It searches `"<provider>" GPU "case study" OR "powered by"
   OR "we use"` off the provider's site. A result is a client when its title or summary names the
   provider and a usage word ("uses", "powered by", "migrated"). Comparison, pricing, review and
   "top 10" pages are skipped. The signal reads "Mentions using <provider>".

Each search runs again only after 30 days (`repeat_days`). Every search counts against
`SEARCH_DISCOVERY_PER_RUN`. Without a key, the run reads the CSV list only, as before.
## Partner research

Find leads, Partner research tab. It finds system integrators that win government work, so you
can offer to deliver under them. It is not a profile: it has its own job (`python -m leads
partners`), its own data folder (`data/partners/`), lock and log, and runs beside a profile run.
Every number and word list is in `leads/partners/config.py` (`PARTNERS`).

```
spec -> searches + GeBIZ -> facts -> merge -> score -> website + person -> wording
```

1. **Spec.** The form sends countries (a multi-select of the 10 countries above; each has its
   own news sites, agencies, currency and query words in `PARTNERS.countries`; only Singapore
   (GeBIZ) and the United States (USAspending) have a free awards dataset), fields (AI, cloud, data engineering, application development,
   Microsoft), signals, a time window and one sentence of past work. `partners/spec.py` builds
   at most 40 searches from fixed templates. Each country has its own news sites, agencies,
   currency, government word ("ministry", "federal agency") and award phrase
   (`PARTNERS.countries`). A new country is one entry there.
2. **Sources.** Serper (news or web), then Tavily, then Brave, as for people search. Each search
   result is cached for 7 days (`cache.json`), so a repeated search spends no credits. A country
   with a `dataset` also reads free contract awards, no key: Singapore the GeBIZ dataset on
   data.gov.sg (`datastore_search`), the United States USAspending.gov
   (`spending_by_award`, contracts only; with a size filter, small business recipients only).
   Malaysia and the UAE have no open awards data and rely on news. Without a search key only
   the datasets run. The UAE has its own query templates (`queries` on the country): UAE press
   writes "partners with" and "signs agreement with", not "awarded a contract".
   The signal "Names government clients on its website" (`clients`, kind `site`) searches for
   firms whose own site names an agency ("clients include DEWA OR RTA …"). The company and its
   domain come from the result itself. Only home, about, clients, case-study and portfolio
   pages count; articles, listings and `.gov`, `.edu`, `.ac`, `.mil` sites are skipped. A page
   whose summary names no agency is opened (at most 40 a run) and kept only if the page names
   one. A generic agency ("UAE Government") does not count as a client. This is the main
   source of SMEs where the news covers only large firms.
3. **Facts, with no model.** `partners/extract.py` reads each result title and summary: the
   company from the headline ("X wins …", "X appointed …", or agency-first "U.S. Navy awards X",
   "Digital Dubai partners with X") or a company suffix (Bhd, Sdn Bhd, Pte Ltd, Inc, LLC,
   FZ-LLC), the value (RM, S$, US$, AED), the agency from a word list per country, the date, the
   field and the signal. With a partnering verb the company after the verb is tried first.
   Agencies, public bodies (university, chamber, ministry acronyms such as MoEI) and big
   vendors (`big_vendors`: Oracle, Microsoft, Canva …) are never the company. A result with no company, no field or no signal is dropped. Up to 30 pages are
   opened to fill a missing value, agency or date.
   The country of a result comes from the article, not the query: place names per country
   (`places`), the news site and the domain ending count. An article that names only another
   country (`other_places`, for example Poland) is dropped. A company whose legal form belongs
   to another country (`legal_forms`: GmbH, Sdn Bhd, Pty Ltd …) is dropped. A GeBIZ award whose
   description names non-IT work (`gebiz.not_ict_words`: vehicle, event, laboratory …) is
   dropped, and the IT fallback needs a specific IT phrase (`gebiz.ict_words`).
4. **Merge and score.** Results join by company name. The score adds recency, signal, value,
   agency, fields, number of sources and a found person (`PARTNERS.score`).
5. **Company size.** "Company size" defaults to fewer than 100 employees; 11-50 and any size are
   the other choices (`PARTNERS.sizes`). One search per company,
   `site:linkedin.com/company <name> "company size"`, reads the size from the result summary,
   for example "Company size: 11-50 employees" or "15,000-strong team". The company page whose
   name matches best, on the country's LinkedIn subdomain, wins. LinkedIn sizes come in
   bands: a band that only partly fits (51-200 for fewer than 100) counts as unknown. Unknown
   sizes are dropped unless "Keep companies whose size is unknown" is ticked. When the full
   name finds no size, a second lookup uses the parent name without country and generic words
   (`size.parent_tails`): "Illumina Singapore Pte. Ltd" becomes "Illumina". The page's
   "Headquarters" line, or its LinkedIn subdomain, gives the home country. A foreign
   headquarters marks the company as too big, except when a full-name match has a local legal
   form: then the page is a different company with the same name, and the size stays unknown.
   A company with an unknown size and at least `size.many_awards` (6) awards counts as too big.
   When LinkedIn gives no size, a web search runs: `"<name>" employees`, then
   `"<name>" <country> number of employees` (`size.web_queries`). Only results from the sites in
   `size.web_sites` (ZoomInfo, RocketReach, Apollo, Dun & Bradstreet, StockAnalysis …) or a
   LinkedIn company page count, and only when the title or address contains the company name.
   When sources disagree, the largest size wins, so a large firm does not pass as an SME. The
   size label names the source, for example "11-50 employees (zoominfo.com)".
   Companies are
   checked best first until the run has enough, at most 120 lookups a run. A size filter also
   lowers the smallest GeBIZ award kept from S$0.5M to S$50k, because small firms win small
   awards. GeBIZ reads up to 5 pages of 100 records per term, at no cost.
6. **Website and person.** Two searches per company: its website, and a `site:linkedin.com/in`
   search for the right level. A listed company (Berhad, Bhd, Bursa, SGX) gets delivery
   leaders; any other gets the CEO or founder. LinkedIn itself is never opened.
   **Unifers enrichment** (switch "Enrich contacts with Unifers", on when `UNIFERS_API_KEY` is set
   on the Settings page, GPU leads tab). `partners/unifers.py` sends each found LinkedIn URL to
   Unifers `people/enrich/linkedin`: full name, current title, employer, location. A person whose
   employer is another company is dropped and costs no reveal. Then `people/reveal/linkedin` gives
   the work email and mobile (`PARTNERS.unifers.reveal`; personal email only with
   `use_personal_email`). At most `unifers.max_people` (20) people a run; each answer is cached
   per LinkedIn URL for `unifers.repeat_days` (30) days, so a repeat run spends no credits. The
   credits spent show on the run (`unifersCredits`). Add to CRM contacts then sends the email and
   phone with the person.
7. **Wording.** Each row gets a template "why" and opening line. With "Improve the wording" on
   and `ANTHROPIC_API_KEY` set on Settings (GPU leads tab), one Claude call rewrites the top 10
   rows. The model is Claude Haiku (`claude-haiku-5-5`, `PARTNERS.llm.model`), the lowest-cost
   Claude model, at effort `low` with thinking off and a JSON schema for the reply, through the
   `anthropic` Python SDK. The model sees one short line per row, never page text. A reply
   with a number that is not in the facts is thrown away and the template stays. Each row is
   sent once: the answer, or the refusal, is cached.

From the results: **Add to CRM contacts** imports the ticked people (no email needed) with
their LinkedIn URL, so the agent enriches them through Unifers (see Leads become CRM contacts). The
lead source defaults to **Cold Outreach** and the lead category is **Partner research**
(`partners` in `packages/validation/src/lead-origin.ts`), so the contacts table shows "Cold
Outreach (Partner research)". The lead-origin note carries the whole row: fields, country, the
reason, the company size, up to 4 evidence items (title, agency, value, date, source, link) and
the opening line. The email drafter reads all of it (`contactContext` in
`apps/agent/agent/lib/email-draft.ts`) with the partnership brief (`CATEGORY_BRIEF.partners` in
`apps/agent/agent/lib/email-knowledge.ts`). The `PARTNERSHIP` lead source exists and can be picked
by hand. And
**Queue on LinkedIn** starts a one-profile scrape in the LinkedIn scraper with the opening line
as the message template, so it waits in the LinkedIn queue for review.
