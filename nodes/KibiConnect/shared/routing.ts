import type {
	DeclarativeRestApiSettings,
	IDataObject,
	IExecutePaginationFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
} from 'n8n-workflow';

import { asReadableError } from './transport';

/**
 * The one piece of code that runs around every declarative request.
 *
 * A declarative node has no hook that sees a failed request: `preSend` runs
 * before the call, `postReceive` only after a successful one, and the routing
 * engine's own catch re-throws a `NodeApiError` untouched (verified in
 * n8n-core's RoutingNode, `runNode`). The single thing it does let a node
 * wrap around the request is the pagination function — `makeRequest` hands
 * the whole request to `requestOperations.pagination` whenever `paginate` is
 * set, and it is that function's job to call `makeRoutingRequest`. So this is
 * registered as the node's pagination function, `paginate` is switched on
 * for every operation through the Resource parameter, and the function does
 * two things the routing block cannot: it turns a failure into a message that
 * says what to do, and it walks the pages when Return All is on.
 *
 * The routing engine only ever calls this when `requestOperations.pagination`
 * is set on the node and some displayed parameter carries
 * `routing.send.paginate` — the node structure test pins both.
 */
export async function kibiRoutingRequest(
	this: IExecutePaginationFunctions,
	requestData: DeclarativeRestApiSettings.ResultOptions,
): Promise<INodeExecutionData[]> {
	const resource = this.getNodeParameter('resource', '') as string;
	const returnAll = this.getNodeParameter('returnAll', false) as boolean;

	try {
		if (!returnAll) {
			return await this.makeRoutingRequest(requestData);
		}
		return await collectAllPages.call(this, requestData);
	} catch (error) {
		throw asReadableError.call(this, error, resource);
	}
}

interface ListEnvelope {
	data?: unknown;
	meta?: {
		current_page?: number;
		last_page?: number;
		next_cursor?: string | null;
	};
}

/**
 * Walks every page of a list and returns the records of all of them.
 *
 * Kibi pages two ways: the Laravel page envelope (`meta.current_page` /
 * `meta.last_page`, `?page=`) on most lists, and a cursor envelope
 * (`meta.next_cursor`, `?cursor=`) on the share-link listings. Both are
 * recognised from the response, so a list operation does not have to say
 * which one it is. A list without either (the surveys, the time entries)
 * ends after the first request.
 *
 * The pages are fetched directly rather than through `makeRoutingRequest`,
 * because that one returns the records after `postReceive` has unwrapped
 * them — and the `meta` block that says whether another page exists is gone
 * by then. The unwrapping is therefore repeated here, which is only correct
 * because every list operation with Return All unwraps `data` and nothing
 * else; the node structure test enforces that.
 *
 * The query string the operation built — filters, sort, the page size that
 * Return All sets — is kept on every page. The page size is not touched
 * here: each API has its own ceiling (50 on v1, 100 on the Files API) and the
 * Return All parameter of the operation sends the right one.
 */
async function collectAllPages(
	this: IExecutePaginationFunctions,
	requestData: DeclarativeRestApiSettings.ResultOptions,
): Promise<INodeExecutionData[]> {
	const options = requestData.options;
	const baseQs = { ...((options.qs as IDataObject | undefined) ?? {}) };
	const records: INodeExecutionData[] = [];
	let position: IDataObject = {};

	for (;;) {
		const response = (await this.helpers.httpRequestWithAuthentication.call(
			this,
			'kibiConnectApi',
			// ResultOptions types its options loosely because they may still hold
			// expressions; by the time the pagination function runs they are
			// resolved, which is what rawRoutingRequest relies on as well.
			{
				...options,
				qs: { ...baseQs, ...position },
				returnFullResponse: true,
			} as unknown as IHttpRequestOptions,
		)) as { body?: ListEnvelope };

		const body = response.body ?? {};
		const data = Array.isArray(body.data) ? body.data : body.data === undefined ? [] : [body.data];
		records.push(...data.map((json) => ({ json: json as IDataObject })));

		const meta = body.meta ?? {};

		if (typeof meta.next_cursor === 'string' && meta.next_cursor !== '') {
			position = { cursor: meta.next_cursor };
			continue;
		}

		if (
			typeof meta.current_page === 'number' &&
			typeof meta.last_page === 'number' &&
			meta.current_page < meta.last_page
		) {
			position = { page: meta.current_page + 1 };
			continue;
		}

		return records;
	}
}
