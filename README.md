# Kibi Connect for n8n

`@weslink/n8n-nodes-kibi-connect` — an [n8n](https://n8n.io) community node package for
[Kibi Connect](https://kibi-connect.eu).

Kibi Connect is a workplace collaboration platform for companies whose people are mostly not
at a desk: production, logistics, care, trades, retail. Chat, feed, wiki, tasks, calendar,
groups, files and documents, time tracking and video calls live in one platform, hosted in the
EU. This package lets n8n read from and write to a Kibi Connect tenant, and start workflows
when something happens there.

## What is in the package

**Kibi Connect** — the action node. 18 resources, 129 operations, one per endpoint of the
REST API. Every list operation offers *Return All* with automatic paging, every ID field
validates the 26-character Kibi ID before a request goes out, and the pickers for people,
conversations, group types and absence types load their options from your tenant.

| Resource | What it covers |
|---|---|
| Calendar Event | Create, read, update and delete events; upsert by external ID |
| Call Link | Meeting links that guests open without a Kibi account; create, reschedule, deactivate |
| Chat | Send messages to a conversation or directly to a person, read messages, react |
| Document | The document management system: upload, download, list with filters, fulltext search, inbox, folder structure |
| File | The file manager: upload, download, versions, search, star, trash and restore, share links, PDF conversion |
| Folder | Folders of the file manager: create, update, tree, items, share links |
| Group | Teams, departments and projects with their posts, members, files and folders; create and map to an external ID |
| Media | Upload images for wiki pages |
| Notification | Send notifications through Kibi's own delivery rules, read and mark them |
| Post | News and announcements in the feed; upsert by external ID |
| Search | Search posts, wiki pages and people in one call |
| Share Link | Public links to files and folders: send, update, revoke, read the access log |
| Shared Wiki | Wiki subtrees published for the outside world, including their images |
| Survey | Published surveys and their answer options (read-only) |
| Task | Work items on a board, with any number of assignees; upsert by external ID |
| Time Tracking | Clock in and out, time entries, absences, balances, absence types, work schedules |
| User | The employee directory (no private data) |
| Wiki Page | Knowledge base pages; upsert by external ID |

**Kibi Connect Trigger** — the trigger node. Starts a workflow when Kibi delivers a webhook:
a post was created, a task completed, a file uploaded, and so on. It registers its own
endpoint in Kibi if you let it, verifies every delivery's signature, and drops the echoes of
its own writes so that a two-way sync cannot loop.

## Installation

**Verified node** (n8n Cloud and self-hosted): open **Settings > Community Nodes**, choose
*Install*, enter `@weslink/n8n-nodes-kibi-connect` and confirm.

**Self-hosted, by hand**: the same dialog works. Alternatively run
`npm install @weslink/n8n-nodes-kibi-connect` in your n8n custom directory
(`~/.n8n/custom` by default) and restart n8n. See the
[community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
for the details of either path.

## Credentials

Both nodes use one credential, **Kibi Connect API**.

1. The tenant's REST API has to be switched on: a system administrator does that under
   **Administration > API**. The same page holds the IP allow list, if your tenant uses one.
2. Create a token in Kibi under **My Profile > Integrations**. Grant it the scopes the
   operations you plan to use need (table below). Tokens cannot be edited afterwards — a
   missing scope means issuing a new token.
3. If the token is meant for the trigger node or for anything that maps records to your own
   IDs, give it an **integration slug** when you create it. The slug cannot be added later.

| Field | Notes |
|---|---|
| Base URL | Your tenant's address, e.g. `https://acme.kibi.de`. No trailing slash, no `/api` — the node appends the API path itself. |
| API Token | The token, as shown once when it was created. |
| Integration Slug | The slug chosen at token creation. Needed by the trigger node (to register its endpoint and to recognise its own writes) and by the upsert-by-external-ID operations. Leave empty if the token has none. |

### Scopes per resource

Scope names and descriptions as Kibi lists them on the token form.

| Resource | Scope | What the scope grants |
|---|---|---|
| Calendar Event | `calendar:read` | Read calendar events |
| | `calendar:write` | Create, update, and delete calendar events |
| Call Link | `calls:read` | Read meeting links created through this integration |
| | `calls:write` | Create and manage meeting links, including on behalf of another user (for booking systems that own the appointment) |
| Chat | `chat:read` | Read conversations and messages |
| | `chat:write` | Send messages (for bots and automations) |
| Document | `files:read` | Read folders, items, versions and the sync change-feed |
| | `files:write` | Create, update, move, delete and restore folders and items |
| File, Folder, Share Link | `files:read` | Read folders, items, versions and the sync change-feed |
| | `files:write` | Create, update, move, delete and restore folders and items |
| Group | `groups:read` | Read public groups, members, posts and files |
| | `groups:write` | Create groups and link them to objects in an external system (never changes an existing group) |
| Media | `wiki:write` | Create and update wiki pages |
| Notification | `notifications:read` | Read user notifications |
| | `notifications:write` | Send notifications to users (incl. push) |
| Post | `posts:read` | Read published posts and announcements |
| | `posts:write` | Create, update, and delete posts |
| Search | `search` | Cross-entity search |
| Shared Wiki | `wiki:read` | Read wiki pages and documentation (Get Media needs no scope at all — it is a public image proxy) |
| Survey | `surveys:read` | Read surveys and results |
| Task | `tasks:read` | Read tasks assigned to or created by token creator |
| | `tasks:write` | Create and update tasks |
| Time Tracking | `time-tracking:read` | Read time entries, absences, balances and work schedules |
| | `time-tracking:write` | Clock in and out, create and update time entries and absences |
| User | `users:read` | Read public user directory (no private data) |
| Wiki Page | `wiki:read` | Read wiki pages and documentation |
| | `wiki:write` | Create and update wiki pages |
| Trigger (automatic mode) | `webhooks:read` | List the webhook endpoints this integration owns, and the events they can subscribe to |
| | `webhooks:write` | Create, update and delete webhook endpoints owned by this integration. Only takes effect for a token whose owner is a system administrator |

Two resources also need a module installed in the tenant, on top of the scope: **Document**
needs the Document Management module, **Time Tracking** needs the Time Tracking module. Kibi
answers 404 for every route of a module that is not installed — the same answer an unknown ID
gets, on purpose — and the node says so in its error message.

A token acts as the person it belongs to. Messages, posts and time entries are attributed to
that account, and the token sees only what that account may see. For anything that writes,
ask an administrator for a dedicated service account rather than using a personal one.

## The trigger node

The **Kibi Connect Trigger** node has two ways of getting its webhook endpoint into Kibi.

### Automatic mode (default)

With *Register Webhook Automatically* switched on, activating the workflow creates the endpoint
in Kibi, deactivating it removes it again, and switching between test and production URLs
updates it. Nothing to click in Kibi. Three things are required of the token:

- the scopes `webhooks:read` and `webhooks:write`,
- an **integration slug** — endpoints are owned by an integration, and a token without a
  slug cannot own one,
- a **system administrator** as the token's owner. The scope alone is not enough; Kibi
  refuses the registration with 403 otherwise.

The signing secret that Kibi hands out once, at creation, is stored in the workflow's static
data. If it is ever lost, the node reports the endpoint as missing and re-creates it on the
next activation.

### Manual mode

Switch *Register Webhook Automatically* off when the token cannot meet the requirements
above, or when an administrator wants to keep endpoint management in Kibi. Then:

1. Copy the node's webhook URL from the n8n editor.
2. In Kibi, go to **Administration > Webhook endpoints**, create an endpoint with that URL and
   the events you want.
3. Paste the signing secret Kibi shows once into the node's *Webhook Secret* field.

Manual mode works with any Kibi Connect version that has outgoing webhooks.

### Events, verification and output

The events to react to are chosen in the node; the list is loaded from your tenant. In
automatic mode the endpoint is subscribed to exactly those events. In either mode the node
also filters locally, so an endpoint that somebody widened in Kibi's administration still
starts the workflow only for the events its author picked. An empty selection means every
event.

Every delivery is verified against the `X-Kibi-Signature` header, an HMAC-SHA256 over the raw
request body with the endpoint's secret. A delivery that fails the check is answered with 401
and does not start the workflow — the webhook URL is not a secret, and this is what keeps a
stranger who found it from starting your workflows.

The output item is Kibi's delivery envelope plus two header values:

| Field | Content |
|---|---|
| `event` | The event name, e.g. `post.created` |
| `timestamp` | When the event happened |
| `tenant_id` | The tenant it happened in |
| `data` | The record itself, plus `origin` (see below) |
| `deliveryId` | Kibi's ID for this delivery, from `X-Kibi-Delivery-Id`; useful for de-duplication |
| `deliveredAt` | When Kibi sent it, from `X-Kibi-Timestamp` |

## Breaking sync loops

A workflow that both listens to Kibi and writes to Kibi is one step away from a loop: the
write triggers the webhook, the webhook triggers the write, and so on until somebody notices.

Every webhook payload carries `data.origin`:

- `origin.source` is `api` when the change came through the REST API with a token, and `ui`
  for anything a person or a background job did.
- `origin.integration` is the integration slug of the token that made the change, or `null`
  when the token has none.

The trigger node's *Ignore Own Writes* option drops every delivery whose `origin.integration`
equals the **integration slug in the credential**. It is on by default, because a workflow
that writes nothing loses nothing by it, and a workflow that does write is protected from the
start. Two consequences worth knowing:

- The comparison is against the slug in the credential. A trigger with a credential whose
  token has no slug cannot recognise anything as its own, so the option has no effect there.
- Two workflows sharing one integration slug ignore each other's writes too. Give each
  integration its own slug if that is not what you want.

For workflows that need finer control, switch the option off and branch on
`{{ $json.data.origin.source }}` and `{{ $json.data.origin.integration }}` yourself.

## Examples

Two ready-made workflows live in the `examples/` directory of the repository. Import one via
**Workflow > Import from File**, then select your Kibi Connect credential in each node.

### Announce new posts in a chat channel

`examples/announce-new-posts-in-chat.json`

A **Kibi Connect Trigger** listens for `post.created`. For every delivery, a **Kibi Connect**
node (Chat > Send Message) posts a short announcement with the title and a link into a
conversation — a team channel, say — so that people who live in chat do not miss what was
published in the feed. The token needs `chat:write`, and for automatic endpoint registration
`webhooks:read`, `webhooks:write`, an integration slug and a system administrator as owner;
`posts:read` is not required, because the delivery already carries the post.
Adapt the *Conversation* in the Send Message node (pick it from the list) and the message
text, which is an expression over `$json.data`.

### File invoices from a mailbox into the DMS

`examples/file-invoices-from-email-into-the-dms.json`

An **Email Trigger (IMAP)** watches a mailbox and hands over each mail with its attachments.
A **Kibi Connect** node (Document > Create) uploads every PDF attachment into the document
management system, where Kibi's document intelligence extracts the metadata and files it. A
second **Kibi Connect** node (Chat > Send Message) then tells the accounting conversation
which documents arrived. The token needs `files:write` for the upload and `chat:write` for the
message; the tenant needs the Document Management module. A small Code node in between turns
the mail's attachments (`attachment_0`, `attachment_1`, ...) into one item per PDF with the
file in `data`, so the upload needs no adapting. Adapt the IMAP credential and folder, the
target *Folder ID* if the documents should not land in the DMS root, and the *Conversation*
for the summary.

## Binary data

- **Uploads** (Document > Create, File > Upload, Media > Upload) read the binary property named
  in *Input Binary Field* — `data` by default, which is what most n8n nodes produce. The file
  name and MIME type travel with it.
- The Files API accepts a single-shot upload of up to **64 MiB**. Larger files need the
  chunked upload flow, which this package does not implement.
- **Downloads** (Document > Download, File > Download, File > Download Version, Shared Wiki >
  Get Media) produce a binary property `data`, and put `fileName`, `mimeType` and `fileSize`
  into the item's JSON. The file name is taken from Kibi's `Content-Disposition` header,
  umlauts included.
- File > Download streams the bytes through the authenticated endpoint rather than following a
  redirect to object storage, so the token never leaves your tenant's domain. File > Get
  Access URL mints a short-lived direct URL for consumers that cannot send the token.

## Rich text

Posts, wiki pages, task descriptions and calendar event descriptions are rich text. The node
defaults to **HTML** on both the way in (*Content Format*) and the way out (*Read Format*).
**Markdown** and **JSON** (Kibi's document tree, the only exact representation) are available
on the same fields. HTML and Markdown are converted at the boundary, and anything Kibi has no
element for is dropped in that conversion — a round trip does not have to give back exactly
what it was handed.

## Tasks and assignees

A task in Kibi belongs to any number of people, and the node has two fields for that:
*Assignee* picks one person from the directory, *Additional Assignees* takes the rest as a
comma-separated list of user IDs — an expression returning an array works too. The two are
merged into the API's `assignees` list, so the person in the picker is always assigned;
filling both fields means both people. A workflow that only ever used *Assignee* keeps
sending exactly what it sent before.

Two things worth knowing:

- Assigning on *Update* replaces the whole list. The people you name are the people the task
  ends up with, not additions to whoever is on it already — read the task first if you mean
  to add somebody.
- *Upsert by External ID* creates a task without assignees. The API takes no assignees on
  that route, so the node does not offer the fields there; assign in a second *Update* step
  if the upsert has to end with somebody on the task.

*Get Many* returns what the token owner may see: every task on a board they have access to,
plus the personal tasks they created or were assigned. **Only Mine** narrows it to the second
group — the tasks they created or are assigned to — which is the `mine=true` filter of the
API and the way to ask "what did this integration put into Kibi".

## Notifications and chat

Two resources put something in front of a person, and they are not the same thing:

- **Notification > Send** writes into the recipients' notification list, with a title, a body
  and a link of your choosing. Kibi decides when and how it is delivered: do-not-disturb,
  quiet hours and each person's own push settings all apply, so a notification sent at 23:00
  to somebody with quiet hours is not lost but does not arrive at 23:00 either.
- **Chat > Send Message** writes a message into a conversation, where it is read in that
  conversation and follows that conversation's own rules.

Which one fits depends on whether the workflow has something to announce or something to say.

## Dates and time zones

Every field that means a moment — *Due Date*, *Scheduled At*, *Expires At*, *Changed Since* —
is sent as a full ISO 8601 timestamp including its time zone, so the instant the editor shows
is the instant Kibi stores, whichever time zone n8n and the tenant sit in. Nothing has to be
converted to UTC by hand in an expression.

The day-only parameters are a different thing and stay days: the calendar's *From Date* and
*To Date* filters and Time Tracking's *Date*, *Date From* and *Date To* are calendar days in
the API, not moments.

*Due Date* travelled as a bare calendar day until 1.0.1, cut off after a conversion to UTC.
That dropped the time of day, and for a due date late in the evening in a tenant east of UTC
it moved the date itself a day back. Since 1.1.0 the whole moment is sent. A workflow that
set a due date at midnight local time therefore lands on the day it always meant — which may
be one day later than what the same workflow produced before.

## Compatibility

- n8n 1.x.
- A Kibi Connect tenant with the REST API enabled (**Administration > API**).
- Automatic webhook registration requires Kibi Connect **6.8.0** or newer — the
  `/api/v1/webhook-endpoints` routes ship with that release. Manual mode works with any
  version that has outgoing webhooks.
- The File, Folder and Share Link resources, and the Document resource's fulltext search,
  recent, inbox and doc-type reads, need a Kibi Connect version with the Files API V2 (6.x).
- The Document and Time Tracking resources need their module installed in the tenant.

## License

[MIT](LICENSE.md)
