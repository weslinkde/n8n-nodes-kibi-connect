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
		displayOptions: { show: showOnlyForUsers },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a user',
				description: 'Retrieve one entry from the employee directory',
				routing: {
					request: { method: 'GET', url: '=/users/{{$parameter.userId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many users',
				description: 'Retrieve the employee directory',
				routing: {
					request: { method: 'GET', url: '/users' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'getAll',
	},

	{
		displayName: 'User',
		name: 'userId',
		type: 'resourceLocator',
		required: true,
		default: { mode: 'list', value: '' },
		description: 'Whose directory entry to read',
		displayOptions: { show: { ...showOnlyForUsers, operation: ['get'] } },
		modes: [
			{
				displayName: 'From List',
				name: 'list',
				type: 'list',
				typeOptions: { searchListMethod: 'getUsers', searchable: true },
			},
			{
				displayName: 'By ID',
				name: 'id',
				type: 'string',
				hint: 'The user ULID — 26 characters',
				placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$',
							errorMessage: 'A Kibi ID is 26 characters (a ULID) — this does not look like one',
						},
					},
				],
			},
		],
	},

	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		placeholder: 'Müller',
		description: 'Filter the directory by name, case-insensitively',
		displayOptions: { show: { ...showOnlyForUsers, operation: ['getAll'] } },
		routing: { request: { qs: { search: '={{ $value }}' } } },
	},

	{
		displayName:
			'This is the public employee directory: name, department, position and picture. It never carries private data such as a home address or a date of birth, whatever the token\'s scopes are.',
		name: 'directoryNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: showOnlyForUsers },
	},

	...returnAll('user', 'getAll'),
];
