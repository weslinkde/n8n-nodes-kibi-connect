import { NodeApiError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteFunctions,
	IExecuteSingleFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';

import { describeApiError, type KibiErrorBody } from './errors';

/**
 * The envelope every Kibi collection comes in. `meta` is what tells a caller
 * whether another page exists — `links.next` says the same thing, but the
 * page numbers are what the request takes.
 */
export interface ListResponse<T> {
	data: T[];
	meta?: {
		current_page: number;
		last_page: number;
		total: number;
	};
}

export type KibiRequestContext =
	IHookFunctions | IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions;

/**
 * A direct call to the Kibi API, for the paths the declarative router cannot
 * serve: the searchable pickers, the dynamic option lists, and the trigger's
 * webhook lifecycle. Everything a workflow author drives themselves goes
 * through `routing` instead.
 *
 * The base URL is per tenant and lives in the credential, because every
 * customer has their own host — there is no single api.kibi.de to point at.
 */
export async function kibiApiRequest<T>(
	this: KibiRequestContext,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<T> {
	const credentials = await this.getCredentials('kibiConnectApi');
	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}/api/v1${path}`,
		body,
		qs,
		json: true,
	};

	try {
		return (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'kibiConnectApi',
			options,
		)) as T;
	} catch (error) {
		throw asReadableError.call(this, error, resourceOfPath(path));
	}
}

/**
 * The resource an API path belongs to, for the module-gate explanation.
 *
 * Derived from the path rather than from a node parameter, because the
 * pickers and the trigger's lifecycle calls have no `resource` parameter to
 * read.
 */
export function resourceOfPath(path: string): string {
	if (path.startsWith('/time-tracking')) {
		return 'timeTracking';
	}
	if (path.startsWith('/dms')) {
		return 'document';
	}
	return 'other';
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

/**
 * Turns an HTTP failure into an error whose message says what to do about it.
 *
 * Without this the picker lists just go empty and the node reports "Not
 * Found", which sends people looking for a typo in an ID when the real answer
 * is that a module is not installed or the token is missing a scope.
 *
 * The request helpers already throw a `NodeApiError`, and wrapping one of
 * those in another `NodeApiError` is a no-op: since n8n-workflow 2.x the
 * constructor returns the instance it was handed, options and all, so a
 * message passed that way never reaches anyone. The readable message is
 * therefore written onto the existing instance, which keeps its status,
 * context and cause intact for whoever inspects them further up (the trigger
 * does, to tell a 404 from everything else). Only an error that is not a
 * `NodeApiError` yet — a network failure, a legacy shape — gets a new one.
 */
export function asReadableError(
	this: KibiRequestContext,
	error: unknown,
	resource: string,
): NodeApiError {
	const { status, body } = extractHttpFailure(error);
	// Without a status there is nothing to explain — a connection refused or
	// a DNS failure says more in its own words than "HTTP 0" would.
	const message =
		status === 0 && error instanceof Error
			? error.message
			: describeApiError(status, body, resource);

	if (isNodeApiError(error)) {
		error.message = message;
		return error;
	}

	return new NodeApiError(this.getNode(), (error as JsonObject) ?? {}, {
		message,
		httpCode: status ? String(status) : undefined,
	});
}

/**
 * `instanceof` plus a name check: a community package and the n8n it runs in
 * can resolve `n8n-workflow` to two copies, in which case the class identity
 * differs while the shape is the same.
 */
function isNodeApiError(error: unknown): error is NodeApiError {
	return (
		error instanceof NodeApiError ||
		(error instanceof Error && error.constructor.name === 'NodeApiError')
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
