# @weslink/n8n-nodes-kibi-connect

An [n8n](https://n8n.io) community node for [Kibi Connect](https://kibi.de) — the European
workplace collaboration platform, made in Germany. Chat, feed, wiki, tasks, calendar, files
and time tracking, with data kept in the EU.

> **Early release.** The package ships the credential and the resources Calendar Event,
> Call Link, Chat, Document, Group, Media, Notification, Post, Search, Shared Wiki, Survey,
> Task, Time Tracking, User and Wiki Page — every operation of the v1 REST API plus the v2
> document reads. The webhook trigger is being added.
>
> Document and Time Tracking need their module installed in the tenant: Kibi answers 404
> for every route of a module that is not installed, the same answer an unknown ID gets.

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

## Compatibility

Requires n8n 1.x and a Kibi Connect tenant with the REST API enabled.

## License

[MIT](LICENSE.md)
