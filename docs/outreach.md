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

The Overview has the same **Sent with Outreach Engine / Sent with Unifers** tabs as Campaigns. Unifers has no dashboard endpoint. The Unifers tab lists the newest `UNIFERS.overview.maxCampaigns` campaigns, reads `/campaigns/{id}/analytics` for each started one and adds them up (`campaignTotals` in `lib/unifers/overview.ts`). It also lists the Unifers mailboxes.

**Add contact** on Audiences → Contacts adds one person to a list. The engine has
no single-contact create in the CRM's API map, so the dialog builds a one-row CSV
(`lib/outreach/single-contact.ts`) and sends it through `/contacts/import/confirm`
with a fixed column mapping. The import report says whether the person was new,
already a contact (details updated), suppressed or invalid. The list picker starts
on the list the tab is filtered to.
Lists do not store their columns, so the form reads up to 100 of the list's
contacts and shows one input per custom field they use (`listColumns`), most used
first. Only filled cells are sent, so adding an existing contact never blanks a
field it already has.

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

## Unifers, the second sender

Each campaign is sent by the Outreach Engine **or** by Unifers
(`https://api.unifers.ai`, API reference v1.0.0). The engine path is unchanged.

```
browser ──► CRM app /api/unifers/<path>      (apps/app/app/api/unifers/[...path]/route.ts)
              1. Better Auth session, or 401
              2. a sending change needs a CRM owner or admin, or 403
              3. adds X-API-Key (and X-Workspace-Id) on the server
              ▼
            Unifers /client-apis/<path>
```

- **Only `campaigns` and `email-accounts` pass** (`upstreamPath` in
  `lib/unifers/bridge.ts`). The paid people endpoints (search, enrich, reveal)
  are blocked, so nobody spends credits by accident. The research agent calls
  enrich and reveal itself, server side; see "Unifers" in `docs/agent.md`.
- **Owners and admins only** (`adminOnly`): connecting or disconnecting a
  mailbox, `campaigns/{id}/status` (start, schedule, pause, cancel), and
  creating a campaign with `startAt`. Members create drafts and add leads.
- **Optional.** Without `UNIFERS_API_KEY` the Unifers screens say it is not
  connected; engine campaigns keep working. `UNIFERS_WORKSPACE_ID` and
  `UNIFERS_API_URL` are optional.
- **Screens, inside the existing Campaigns section:**
  - The list has a "Sent with" switch (`?sender=unifers`); Unifers rows carry a
    badge.
  - New campaign first asks Send with: Outreach Engine (the existing wizard) or
    Unifers (`wizard/unifers-wizard.tsx`): name, an Outreach audience list
    whose active, unsuppressed contacts become leads, the email sequence, the
    Unifers mailboxes, the sending window and stop rules, then draft, start
    now or schedule. Unifers has no edit endpoint, so the campaign is created
    in one call at the end.
  - **Generate with AI** (`wizard/campaign-writer.tsx`) writes the subject and
    body of every step in one Claude Haiku call: `contacts.draftCampaign` →
    agent `/internal/crm/draft-campaign` (`apps/agent/agent/lib/campaign-draft.ts`).
    It sends only the product summary, the lead type brief, the tagline, up to
    five common titles and companies from the chosen list, and the placeholders
    the list can fill (`audienceFields` in `lib/unifers/campaign-draft.ts`).
    Thinking is off and `max_tokens` is 450 per step (`campaign-draft-config.ts`).
    Placeholders the list cannot fill are removed from the answer.
    Links are off by default: "Add a website link to the first email" turns
    them on. When off, Claude is told to write none and any URL is removed.
  - **Sign-off.** The model writes no signature. On create, every body gets
    `UNIFERS.signOff` (`Regards,`) and the first name of the sending mailbox's
    From name, written as text (`signOffName`). Unifers fills
    `{{sender.firstName}}` from its account profile, not from the mailbox, so
    the wizard does not use it. With no ticked mailbox, the default mailbox
    signs. Ticked mailboxes with different first names get no sign-off and a
    warning. A body that already has `{{sender.…}}` is left as it is. The
    wizard checkbox turns the sign-off off.
  - **Footer.** "Lines after the name (optional)" is free text: an address,
    a phone, any line. `signEmail` adds it under the name in every email, or
    after the body when there is no name. It is kept in this browser's
    `localStorage` (`UNIFERS.footer.storageKey`) for the next campaign.
  - A Unifers campaign opens at `/outreach/campaigns/u-<id>`
    (`parseUnifersRouteId`): status and controls, analytics, steps and leads by
    event.
  - **Reply text.** The Unifers API returns who replied, never what they wrote:
    a replied lead is only `email`, `name` and step names. The Replied tab reads
    the text from mail the CRM already synced, through `contacts.unifersReplies`
    (`ContactEmailService.replies`): the newest INBOUND `EmailMessage` from each
    lead's address since the campaign was created. This works only after the
    sending mailbox is connected in Settings → Connections. Linking a mailbox
    with a different address is allowed (`accountLinking.allowDifferentEmails`).
    Without it, the tab says the reply is not synced and links to Connections.
    Owners and admins see every synced reply (`scope: "all"`). A member sees
    only replies whose `syncedByUserId` is their own, from the mailbox they
    connected (`scope: "own"`). The role check is `isWorkspaceAdmin`.
  - **Tenant mail.** When every Unifers mailbox is in one Microsoft 365 tenant,
    `UNIFERS_MAIL_TENANT_ID`, `UNIFERS_MAIL_CLIENT_ID` and
    `UNIFERS_MAIL_CLIENT_SECRET` let the CRM read them directly, without anyone
    connecting a mailbox. The app registration needs the Graph application
    permission `Mail.Read` with admin consent. `POST /api/unifers/replies`
    (`lib/unifers/tenant-mail.ts`, server only) lists the mailboxes from
    Unifers `/email-accounts` (verified ones only), gets an app-only token, and reads each mailbox's
    messages since the campaign was created (`UNIFERS.tenantMail`). It keeps the
    newest message from each lead, using `uniqueBody` so quoted text is left out.
    Owners and admins read every Unifers mailbox; a member reads only the
    mailbox with their own login address. The page merges these with the synced
    replies (`mergeReplies`) and shows the newest. A mailbox Microsoft refuses
    is named on the page; the others still show.
  - **Reply.** Each reply with a Graph message id has an "Open conversation" button, on the
    campaign's Replied tab and in the contact sheet's "Their latest reply"
    (`components/unifers/lead-reply.tsx`, last 30 days). `ReplyDialog` starts
    with the sending mailbox's sign-off and the saved footer, and "Draft with
    AI" calls `contacts.draftReply` → agent `POST /internal/crm/draft-reply`
    (`REPLY_DRAFT`: Haiku, thinking off, 300 output tokens, the lead's text cut
    to 1,200 characters, no sign-off, no links). The same section sits at the
    top of the contact's Activity tab, above the timeline. Send posts to
    `POST /api/unifers/replies/send`, which calls Graph `messages/{id}/reply`
    as that mailbox, so the answer stays in the thread with theirs quoted. It
    needs the Graph application permission `Mail.Send`. The mailbox must be a
    verified Unifers mailbox; a member may reply only from their own.
    The same check is `mailboxRefusal` in `lib/unifers/tenant-access.ts`.
  - **Conversation.** The button is "Open conversation". `ReplyDialog` reads
    `POST /api/unifers/replies/thread` (`tenantThread`): it gets the message's
    `conversationId`, then every message with that id from all folders, inbox
    and Sent Items, at most `UNIFERS.tenantMail.threadMax`. Drafts are dropped.
    `threadEntries` (`lib/unifers/thread.ts`) orders them oldest first and marks
    a message OUTBOUND when it is from the mailbox itself. Send answers the
    lead's newest INBOUND message (`latestInbound`), not the one first shown.
    The dialog stays open after Send, so the back-and-forth continues in place;
    the sent reply shows when Graph has saved it, within a refresh.
  - **Waiting on us / them.** The reply scan reads messages newest first from
    all folders. A message from the mailbox marks its `conversationId` as
    answered. A lead's newest message then gets `waitingOn: "them"` when its
    conversation was answered after it, otherwise `"us"` (`waitingOnAfter`).
    The Replied tab and the contact sheet show it as a badge; the Replied tab
    has an "All replies / Waiting on us" filter over the current page of leads.
    Replies from a connected mailbox sync have no status.
  - **Reply alerts.** `apps/api/src/reply-alerts` emails people when a lead
    replies, so nobody has to watch the Replied tab. `ReplyAlertsService` runs
    every `REPLY_ALERTS.tick.intervalMs` (2 minutes) in the API process, and
    only when `UNIFERS_API_KEY` and the three `UNIFERS_MAIL_*` variables are set.
    Each tick it lists the verified Unifers mailboxes, reads each inbox for the
    last `lookbackMs` (1 hour), and drops drafts, our own users and mailboxes,
    machine addresses and bounce senders (`isIgnoredSender`). A message counts
    as a reply only when its `conversationId` holds a message from that
    mailbox (`weWroteIn`). The `ReplyAlert` row, unique on the Graph message
    id, is written before the send, so a reply alerts once even across restarts
    and two API replicas. The alert goes out through Graph `sendMail` from the
    mailbox the lead wrote to, not saved to Sent Items, so it never joins the
    lead's thread. It holds their text, a link to the CRM contact (or to the
    Unifers campaigns when there is no contact) and the Outlook link.
    Recipients are the workspace owners (when "Workspace owners" is on) plus
    the addresses in Settings → General → Reply alerts
    (`replyAlerts.settings` / `replyAlerts.update`, owners and admins edit;
    stored on `AppSetting`). The card lists the latest alerts and why one
    was not sent.
  - **Add to CRM.** Every event tab on a Unifers campaign (sent, delivered,
    opened, clicked, replied) has a CRM column and an "Add N on this page to
    CRM" button (`components/unifers/add-to-crm.tsx`). `contacts.matchLeads`
    marks who is already a contact ("In CRM" links to them). Adding asks the
    pipeline `POST /api/leads/lookup` for each email across every profile, the
    highest-scoring profile wins, and `crmImportsFor` (`lib/unifers/crm-leads.ts`) builds
    `contacts.importLeads` rows: name, phone, title, company, domain, LinkedIn,
    segment, country, source, team size, the signal with its URL as evidence,
    and the lead category of that profile. The campaign activity ("Opened in
    “<campaign>”") is added to the signal. Someone the pipeline never found is
    added with the campaign as source and no category. A pipeline that does not
    answer still adds them that way.
  - Lead generation → Leads has "Send N with Unifers", which adds the selected
    rows with an email to an open campaign.
- **Leads go in batches of 1,000** (`addLeadsInBatches`), the Unifers limit.
- **Every response is parsed with Zod** (`lib/unifers/schemas.ts`); an unknown
  campaign status reads as draft instead of breaking the page.

### One email from a contact

**Send email** on a contact opens `components/unifers/send-email-dialog.tsx`.
Claude writes the subject and body (see `docs/agent.md`). The rep edits them and
picks a verified Unifers mailbox. Send creates a one-lead campaign named
"Email to <name> · <time>" that starts now. The window and stop rules are
`UNIFERS.singleSend` in `lib/unifers/unifers-config.ts`.

Starting a campaign is owner or admin only, so a member gets a 403 on send.
A lead already in another Unifers campaign is not added, and nothing is sent.

#### Follow-up and reply tracking

The Send email dialog can add one follow-up. Claude writes it with the first email. The date starts
from the contact's **Next follow-up** (or three days out) and is saved back on the contact. Unifers
sends it as a second step, subject "Re: …", and stops it on a reply (`stopConditions.onReply`).

Each send is saved as an EMAIL activity on the contact. Its `meta` holds the Unifers campaign id,
the sender and the follow-up day (`@crm/validation/unifers-send`). `contacts.logUnifersSend` writes
it and `contacts.unifersSends` reads it. The contact's Overview shows **Emails sent with Unifers**:
the app asks Unifers for each campaign's analytics and shows Replied, Bounced, Clicked, Opened,
Delivered, Sent or Queued, plus the follow-up state. The logic is `sendStatus` in
`lib/unifers/single-send.ts`.
