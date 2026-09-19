import { describeApiError, type KibiErrorBody } from '../KibiConnect/shared/errors';

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

export interface HttpFailure {
	/** The HTTP status, or 0 when the error carried none (a network failure, a bug). */
	status: number;
	/** The parsed JSON body Kibi answered with, or `{}` when there was none. */
	body: KibiErrorBody;
}

/**
 * Pulls the HTTP status and the JSON error body out of whatever the request
 * helpers threw.
 *
 * The shape relied on, verified against n8n-workflow 2.39.1
 * (`dist/cjs/errors/node-api.error.js`): `httpRequestWithAuthentication` wraps
 * the underlying axios failure in a `NodeApiError`, whose constructor copies
 * `axiosError.response.status` into `httpCode` (a string) and
 * `axiosError.response.data` (the parsed body) into `context.data`. The axios
 * error itself remains reachable as `cause`, and a further wrap in a
 * `NodeOperationError` copies `context` along. Older n8n versions used the
 * `request` library, which put the body on `cause.error` / `response.body`
 * instead; both are checked so that the mapping does not silently degrade to
 * the bare status text on either side.
 */
export function extractHttpFailure(error: unknown): HttpFailure {
	let status = 0;
	let body: KibiErrorBody | undefined;

	let current: unknown = error;
	for (let depth = 0; depth < 4 && isRecord(current); depth++) {
		status ||= statusOf(current);
		body ??= bodyOf(current);
		current = current.cause;
	}

	return { status, body: body ?? {} };
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function statusOf(error: Record<string, unknown>): number {
	const response = isRecord(error.response) ? error.response : undefined;

	const candidates = [
		error.httpCode,
		error.statusCode,
		error.status,
		response?.status,
		response?.statusCode,
	];

	for (const candidate of candidates) {
		const parsed = Number(candidate);
		if (Number.isInteger(parsed) && parsed >= 100 && parsed <= 599) {
			return parsed;
		}
	}

	return 0;
}

function bodyOf(error: Record<string, unknown>): KibiErrorBody | undefined {
	const context = isRecord(error.context) ? error.context : undefined;
	const response = isRecord(error.response) ? error.response : undefined;

	const candidates = [context?.data, response?.data, response?.body, error.error];

	for (const candidate of candidates) {
		if (isRecord(candidate) && !Array.isArray(candidate)) {
			return candidate as KibiErrorBody;
		}
	}

	return undefined;
}
