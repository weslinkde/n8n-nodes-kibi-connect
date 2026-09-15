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
	| IHookFunctions
	| IExecuteFunctions
	| IExecuteSingleFunctions
	| ILoadOptionsFunctions;

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
		throw asReadableError.call(this, error, path);
	}
}

/**
 * Re-throws an HTTP failure with a message that says what to do about it.
 *
 * Without this the picker lists just go empty and the node reports "Not
 * Found", which sends people looking for a typo in an ID when the real answer
 * is that a module is not installed or the token is missing a scope.
 */
export function asReadableError(
	this: KibiRequestContext,
	error: unknown,
	path: string,
): NodeApiError {
	const status =
		(error as { statusCode?: number }).statusCode ??
		Number((error as { httpCode?: string }).httpCode ?? 0);

	const body =
		((error as { cause?: { error?: KibiErrorBody } }).cause?.error as KibiErrorBody | undefined) ??
		((error as { response?: { body?: KibiErrorBody } }).response?.body as
			| KibiErrorBody
			| undefined) ??
		{};

	// The resource is derived from the path rather than from a node parameter,
	// because the pickers and the trigger's lifecycle calls have no `resource`
	// parameter to read.
	const resource = path.startsWith('/time-tracking')
		? 'timeTracking'
		: path.startsWith('/dms')
			? 'document'
			: 'other';

	return new NodeApiError(this.getNode(), (error as JsonObject) ?? {}, {
		message: describeApiError(status, body, resource),
		httpCode: status ? String(status) : undefined,
	});
}
