import { describeApiError, type KibiErrorBody } from '../KibiConnect/shared/errors';
import { extractHttpFailure } from '../KibiConnect/shared/transport';

/**
 * The external id under which Kibi knows this node's endpoint.
 *
 * n8n's `webhookId` is stable across activations and unique per node, which is
 * exactly the identity we want: rename the workflow, move the node, switch
 * between test and production URLs — the mapping survives all of it.
 */
export function externalIdFor(webhookId: string): string {
	return `n8n-webhook-${webhookId}`;
}

export function isNotFound(error: unknown): boolean {
	return extractHttpFailure(error).status === 404;
}

/**
 * The ways automatic registration fails, in plain words.
 *
 * All of them are configuration, not bugs, and none is visible from the raw
 * status code alone. Everything not specific to registering an endpoint is
 * handed to the shared describer so that "webhooks are off for this tenant"
 * or "the API is off" read the same here as in the regular node.
 */
export function describeRegistrationError(status: number, body: KibiErrorBody): string {
	if (status === 422 && body.code === 'integration_slug_missing') {
		return 'This API token has no integration slug, so it cannot own a webhook endpoint. Ask a system administrator for a token that has one — the slug is chosen when the token is created and cannot be added later. Or switch off "Register Webhook Automatically" and create the endpoint in Kibi by hand.';
	}

	if (status === 403 && body.code === undefined && !isKnownAccessRefusal(body)) {
		return 'This token may not manage webhook endpoints. It needs the webhooks:write scope AND its owner has to be a system administrator; both are required, and the scope alone is not enough.';
	}

	if (status === 409) {
		return "Another webhook endpoint already claims this workflow's external id. Deactivate the other workflow using it, or remove the endpoint in Kibi under Administration > Webhook endpoints.";
	}

	return describeApiError(status, body, 'webhookEndpoint');
}

/** The 403 variants the shared describer already explains better than a generic text would. */
function isKnownAccessRefusal(body: KibiErrorBody): boolean {
	return (
		body.error === 'API disabled' ||
		body.error === 'IP not allowed' ||
		body.error === 'Insufficient scope'
	);
}
