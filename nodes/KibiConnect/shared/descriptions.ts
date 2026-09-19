import type { INodeProperties, PostReceiveAction } from 'n8n-workflow';

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
 * A stand-in item for an operation whose success answer carries no body.
 *
 * A 204 leaves the routing layer with an empty string where an object should
 * be, and an item whose `json` is a string breaks the next node. Emitting a
 * small object instead keeps the workflow moving and says what happened.
 */
export const emptySuccess: PostReceiveAction[] = [
	{
		type: 'set',
		properties: { value: '={{ { "success": true } }}' },
	},
];

/**
 * The `Return All` / `Limit` pair for a v1 list operation.
 *
 * Kibi paginates with `page` and `limit` and reports `meta.current_page` and
 * `meta.last_page` — verified against the API rather than assumed. The `limit`
 * ceiling on the v1 list endpoints is 50, so asking for more than that in one
 * request silently gets you 50; walking the pages is the only way to more.
 */
export function returnAll(resource: string, operation: string): INodeProperties[] {
	return returnAllFields(resource, operation, 50);
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
 * Same pair as on v1, with the Files API's page size ceiling of 100. Which
 * envelope a list pages with — page numbers on most lists, a cursor on the
 * share-link listings — is recognised from the response and needs no saying
 * here.
 */
export function filesReturnAll(resource: string, operation: string): INodeProperties[] {
	return returnAllFields(resource, operation, 100);
}

/**
 * Neither parameter drives the paging itself. The walk over the pages lives
 * in `kibiRoutingRequest` (see `shared/routing.ts`), which runs around every
 * request of the node and reads `returnAll` from the parameters — the
 * declarative pagination block is not used, because it cannot be combined
 * with the error handling that function exists for. What the parameters do
 * is set the page size: the largest one the API allows when everything is
 * wanted, the requested one otherwise.
 */
function returnAllFields(resource: string, operation: string, ceiling: number): INodeProperties[] {
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
				request: { qs: { limit: `={{ $value ? ${ceiling} : undefined }}` } },
			},
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			typeOptions: { minValue: 1, maxValue: ceiling },
			default: 50,
			description: 'Max number of results to return',
			displayOptions: { show: { ...show, returnAll: [false] } },
			routing: {
				request: { qs: { limit: '={{ $value }}' } },
			},
		},
	];
}
