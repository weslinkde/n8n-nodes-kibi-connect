# n8n-nodes-kibi-connect

An [n8n](https://n8n.io) community node for [Kibi Connect](https://kibi.de), the German
workplace collaboration platform — chat, feed, wiki, tasks, calendar, files and time tracking.

> **Work in progress.** The package currently ships the credential and the User resource.
> The remaining resources and the webhook trigger are being added.

## Installation

Follow the [community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

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

## Compatibility

Requires n8n 1.x and a Kibi Connect tenant with the REST API enabled.

## License

[MIT](LICENSE.md)
