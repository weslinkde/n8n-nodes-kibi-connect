import type { INodeProperties } from 'n8n-workflow';

import { unwrapData } from '../../shared/descriptions';

const R = 'search';
const show = { resource: [R] };

export const searchDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show },
		options: [
			{
				name: 'Search',
				value: 'search',
				action: 'Search across content',
				description:
					'Search posts, wiki pages and people in one go. Results respect group membership and permissions.',
				routing: {
					request: { method: 'GET', url: '/search' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'search',
	},

	{
		displayName: 'Query',
		name: 'q',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Urlaubsantrag',
		description: 'What to search for',
		displayOptions: { show: { ...show, operation: ['search'] } },
		routing: { request: { qs: { q: '={{ $value }}' } } },
	},

	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		default: '',
		description:
			'Restrict the search to one module. The answer always carries the three lists posts, wiki and users — the ones not searched are empty.',
		options: [
			{ name: 'All', value: '' },
			{ name: 'Posts', value: 'posts' },
			{ name: 'Users', value: 'users' },
			{ name: 'Wiki Pages', value: 'wiki' },
		],
		displayOptions: { show: { ...show, operation: ['search'] } },
		routing: { request: { qs: { type: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 50 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { ...show, operation: ['search'] } },
		routing: { request: { qs: { limit: '={{ $value }}' } } },
	},
];
