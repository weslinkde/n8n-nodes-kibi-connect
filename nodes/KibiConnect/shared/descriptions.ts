import type { IDataObject, INodeProperties, PostReceiveAction } from 'n8n-workflow';

/**
 * Kibi wraps every collection in `{ data, links, meta }`.
 *
 * Without unwrapping, every item an n8n workflow sees would be a single
 * envelope object with the real records buried one level down — which works,
 * but makes every downstream expression start with `.data[0]` and turns a
 * "Get Many" into something that emits one item instead of many.
 */
export const unwrapData: PostReceiveAction[] = [
	{
		type: 'rootProperty',
		properties: { property: 'data' },
	},
];

/**
 * The `Return All` / `Limit` pair for a list operation.
 *
 * Kibi paginates with `page` and `limit` and reports `meta.current_page` and
 * `meta.last_page` — verified against the API rather than assumed. The `limit`
 * ceiling on the v1 list endpoints is 50, so asking for more than that in one
 * request silently gets you 50; walking the pages is the only way to more.
 */
export function returnAll(resource: string, operation: string): INodeProperties[] {
	const show = { resource: [resource], operation: [operation] };

	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show },
			routing: {
				operations: {
					pagination: {
						type: 'generic',
						properties: {
							continue:
								'={{ $response.body.meta.current_page < $response.body.meta.last_page }}',
							request: {
								qs: {
									page: '={{ $pageCount + 1 }}',
									limit: 50,
								},
							},
						},
					},
				},
			},
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 50 },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: { show: { ...show, returnAll: [false] } },
			routing: {
				request: { qs: { limit: '={{ $value }}' } },
			},
		},
	];
}

/**
 * The Files API lives under `/api/v2`, one level up from everything else.
 *
 * `requestDefaults.baseURL` points at v1, so every Files operation carries
 * this override in its `routing.request`. The routing engine applies the
 * defaults first and merges each property's `routing.request` on top, so
 * the per-operation value wins — verified in n8n-core's RoutingNode rather
 * than assumed.
 */
export const FILES_BASE_URL = '={{$credentials.baseUrl}}/api/v2';

/**
 * The `Return All` / `Limit` pair for a Files API list operation.
 *
 * The Files API pages two ways. Most lists use the Laravel page envelope
 * (`meta.current_page` / `meta.last_page`, `?page=`); the share-link
 * management view and the access log use a cursor envelope
 * (`meta.next_cursor`, `?cursor=`). The page size ceiling is 100 either way.
 *
 * Two details of the routing engine shape the expressions below. First, the
 * pagination request replaces the query string wholesale rather than merging
 * into it — so the filters the operation already set (`sort`, `q`, `type`)
 * have to be spread back in from `$request.qs`, or the second page would come
 * back unfiltered. Second, `$response` is empty on the first request, so
 * everything read from it is optional-chained.
 */
export function filesReturnAll(
	resource: string,
	operation: string,
	envelope: 'page' | 'cursor',
): INodeProperties[] {
	const show = { resource: [resource], operation: [operation] };

	// The whole query string is one expression that resolves to an object.
	// The type says IDataObject, but the routing engine resolves any string
	// starting with `=` before it looks at the shape — the object form is the
	// only way to spread `$request.qs` back in.
	const qs =
		envelope === 'page'
			? '={{ ({ ...$request.qs, limit: 100, page: ($response.body?.meta?.current_page ?? 0) + 1 }) }}'
			: '={{ ({ ...$request.qs, limit: 100, cursor: $response.body?.meta?.next_cursor ?? undefined }) }}';

	const pagination = {
		continue:
			envelope === 'page'
				? '={{ $response.body.meta.current_page < $response.body.meta.last_page }}'
				: '={{ !!$response.body.meta.next_cursor }}',
		request: { qs: qs as unknown as IDataObject },
	};

	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show },
			routing: {
				send: { paginate: '={{ $value }}' },
				operations: {
					pagination: {
						type: 'generic',
						properties: pagination,
					},
				},
			},
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: 100 },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: { show: { ...show, returnAll: [false] } },
			routing: {
				request: { qs: { limit: '={{ $value }}' } },
			},
		},
	];
}
