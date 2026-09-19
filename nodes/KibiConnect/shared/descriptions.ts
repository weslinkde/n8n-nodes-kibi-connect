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
