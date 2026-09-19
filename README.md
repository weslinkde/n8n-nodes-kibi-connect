# @weslink/n8n-nodes-kibi-connect

An [n8n](https://n8n.io) community node for [Kibi Connect](https://kibi.de) — the European
workplace collaboration platform, made in Germany. Chat, feed, wiki, tasks, calendar, files
and time tracking, with data kept in the EU.

> **Early release.** The package currently ships the credential and the resources
> Calendar Event, Chat, File, Folder, Notification, Post, Share Link, Task, User and Wiki.
> Time tracking and the webhook trigger are being added.

## Installation

Follow the [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and enter `@weslink/n8n-nodes-kibi-connect` as the package name.

## Credentials

Create an API token in Kibi under **My Profile > Integrations** and grant it the scopes the
operations you plan to use need. Tokens cannot be edited afterwards — a missing scope means
issuing a new token.

The credential takes three fields:

| Field | Notes |
|---|---|
| Base URL | Your tenant's address, e.g. `https://acme.kibi.de`. No trailing slash, no `/api`. |
| API Token | The token itself. |
| Integration Slug | Only the trigger node needs it. Chosen when the token is created and immutable afterwards. |

The REST API also has to be switched on for the tenant, under **Administration > API**.

## Files

The File, Folder and Share Link resources talk to the Files API (`/api/v2/files`) and need
the `files:read` scope for reads and `files:write` for writes. A few things worth knowing:

- **Upload** sends the binary property of the input item in one request, which the API
  accepts up to 64 MiB. Larger files need the chunked upload flow, which the node does not
  implement.
- **Download** streams the bytes through the authenticated endpoint rather than following
  the redirect to object storage, so the token never leaves your tenant's domain. **Get
  Access URL** mints a short-lived direct URL for consumers that cannot send the token.
- Files and folders the token owner cannot see answer 404, exactly like unknown IDs.
- Deleting a **folder** destroys the binaries of everything inside it; the entries show up
  in the trash but cannot be restored. Deleting a **file** only moves it to the trash.

## Compatibility

Requires n8n 1.x and a Kibi Connect tenant with the REST API enabled.

## License

[MIT](LICENSE.md)
