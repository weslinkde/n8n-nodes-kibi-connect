# The Kibi Connect v1 API contract

`kibi-v1.json` is the OpenAPI document this node is written against. It is
generated from the platform itself (Scramble) rather than maintained by hand,
and it is checked in so that anyone can regenerate the node's parameters from
the same source the API actually serves.

## Regenerating it

From a Kibi Connect checkout:

```bash
php artisan scramble:export --path=/path/to/n8n-nodes-kibi-connect/openapi/kibi-v1.json
```

**Then replace the `servers` block.** The export stamps in whatever host the
generating machine runs on — a developer workstation, a staging box, an
internal domain. That value is meaningless to anyone reading this package and,
worse, it publishes an internal hostname. It has already happened once:

```json
"servers": [{ "url": "https://your-tenant.kibi.de/api/v1", "description": "Your Kibi Connect tenant" }]
```

The CI leak check greps the whole history for internal hostnames and will fail
the build if one slips through, but catching it before the commit is cheaper
than rewriting history afterwards.
