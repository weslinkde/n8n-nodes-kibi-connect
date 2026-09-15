import type { INodeProperties } from 'n8n-workflow';

import { returnAll, unwrapData } from '../../shared/descriptions';

const showOnlyForUsers = {
	resource: ['user'],
};

export const userDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: showOnlyForUsers,
		},
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a user',
				description: 'Retrieve one entry from the employee directory',
				routing: {
					request: {
						method: 'GET',
						url: '=/users/{{$parameter.userId}}',
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many users',
				description: 'Retrieve the employee directory',
				routing: {
					request: {
						method: 'GET',
						url: '/users',
					},
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'getAll',
	},
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		required: true,
		default: '',
		description: 'The ULID of the user',
		displayOptions: {
			show: { ...showOnlyForUsers, operation: ['get'] },
		},
	},
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		description: 'Filter the directory by name, case-insensitively',
		displayOptions: {
			show: { ...showOnlyForUsers, operation: ['getAll'] },
		},
		routing: {
			request: { qs: { search: '={{ $value }}' } },
		},
	},
	...returnAll('user', 'getAll'),
];
