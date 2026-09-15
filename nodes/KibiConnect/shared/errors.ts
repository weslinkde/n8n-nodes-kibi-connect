/**
 * Turns a Kibi error response into something a workflow author can act on.
 *
 * Kibi answers with `{ error, message }` and, on the paths where branching
 * matters, a machine-readable `code`. Two of its status codes are ambiguous on
 * their own, and those are the reason this function exists:
 *
 *  - **404 on a module-gated resource is not "no such record".** Time Tracking
 *    and the DMS answer 404 for every route when the module is not installed
 *    at all — a deliberate non-leak, so that an outsider cannot tell which
 *    modules a tenant has bought. From inside the node we know which resource
 *    was asked for, so we can say what the bare status cannot.
 *  - **403 covers four unrelated situations**: the API is off for the whole
 *    tenant, webhooks specifically are off, the caller's IP is not allowed, or
 *    the token lacks a scope. Only the last one is fixed by editing anything
 *    the workflow author controls.
 */

/** Resources whose 404 might mean "the module is not installed in this tenant". */
const MODULE_GATED: Record<string, string> = {
	timeTracking: 'Time Tracking',
	document: 'Document Management',
};

export interface KibiErrorBody {
	error?: string;
	message?: string;
	code?: string;
}

export function describeApiError(
	statusCode: number,
	body: KibiErrorBody,
	resource: string,
): string {
	if (statusCode === 404) {
		const moduleName = MODULE_GATED[resource];

		if (moduleName !== undefined) {
			return `Not found. If the ID is correct, the ${moduleName} module is probably not installed in this tenant — Kibi deliberately answers 404 for both cases so that the set of installed modules is not visible from outside. A system administrator can check under Administration > Modules.`;
		}
	}

	if (statusCode === 403) {
		if (body.code === 'webhooks_disabled') {
			return 'Webhooks are not enabled for this tenant. A system administrator switches them on under Administration > Webhook endpoints. This is separate from the REST API toggle.';
		}

		if (body.error === 'API disabled') {
			return 'The REST API is switched off for this tenant. A system administrator turns it on under Administration > API.';
		}

		if (body.error === 'IP not allowed') {
			return "This n8n instance's IP address is not on the tenant's allow list. A system administrator maintains it under Administration > API.";
		}

		if (body.error === 'Insufficient scope') {
			return `${body.message ?? 'The token is missing a scope.'} Tokens cannot be edited after they are created — issue a new one with the scope under My Profile > Integrations.`;
		}

		// The remaining 403 on the webhook routes carries neither `error` nor
		// `code`: it is the policy refusing a token whose owner is not a system
		// administrator. Worth naming, because the scope being present makes
		// people look everywhere except at the account behind the token.
		return (
			body.message ??
			'Refused. On the webhook endpoints this usually means the token is fine but the person it belongs to is not a system administrator — the scope alone is not enough there.'
		);
	}

	if (statusCode === 422 && body.code === 'integration_slug_missing') {
		return 'This token has no integration slug. The slug is chosen when the token is created and cannot be added later — ask a system administrator for a token that has one.';
	}

	if (statusCode === 409 && body.code === 'external_id_taken') {
		return `${body.message ?? 'That external ID is already in use.'} An external ID is unique per integration across the whole tenant, including across resource types — a wiki page and a task cannot share one.`;
	}

	if (statusCode === 412) {
		return 'The record changed in Kibi after the moment you sent as "Only If Unchanged Since". Read it again and decide what to do with the newer version — overwriting it would discard somebody else\'s edit.';
	}

	return body.message ?? body.error ?? `Kibi Connect returned HTTP ${statusCode}.`;
}
