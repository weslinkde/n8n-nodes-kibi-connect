import type { INodeProperties } from 'n8n-workflow';

import { emptySuccess, returnAll, unwrapData } from '../../shared/descriptions';
import { changeScanFields, externalIdField, ulidField } from '../../shared/fields';

const R = 'group';
const show = { resource: [R] };

export const groupDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show },
		options: [
			{
				name: 'Create',
				value: 'create',
				action: 'Create a group',
				description:
					'Create a group and optionally map it to your external ID. A sync can create groups and link them, but never rename, re-type, archive or change the membership of one — those decide who sees what and stay in Kibi. Calling this twice creates two groups.',
				routing: {
					request: { method: 'POST', url: '/groups' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete External Ref',
				value: 'deleteExternalRef',
				action: 'Unlink a group from its external ID',
				description: 'Release the external ID without touching the group itself',
				routing: {
					request: { method: 'DELETE', url: '=/groups/{{$parameter.groupId}}/external-ref' },
					output: { postReceive: emptySuccess },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a group',
				description: 'Read one group with its member count',
				routing: {
					request: { method: 'GET', url: '=/groups/{{$parameter.groupId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Files',
				value: 'getFiles',
				action: 'Get many files of a group',
				description:
					'Read the files of the group file area — the root and every folder below it, newest first',
				routing: {
					request: { method: 'GET', url: '=/groups/{{$parameter.groupId}}/files' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Folders',
				value: 'getFolders',
				action: 'Get many folders of a group',
				description:
					'Read every folder of the group file area as a flat list, parents before their children',
				routing: {
					request: { method: 'GET', url: '=/groups/{{$parameter.groupId}}/folders' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many groups',
				description: 'Read the groups visible to the token owner',
				routing: {
					request: { method: 'GET', url: '/groups' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Members',
				value: 'getMembers',
				action: 'Get many members of a group',
				description: 'Read the members of a group, including their role within it',
				routing: {
					request: { method: 'GET', url: '=/groups/{{$parameter.groupId}}/members' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Posts',
				value: 'getPosts',
				action: 'Get many posts of a group',
				description: 'Read the published posts of a group',
				routing: {
					request: { method: 'GET', url: '=/groups/{{$parameter.groupId}}/posts' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Types',
				value: 'getTypes',
				action: 'Get many group types',
				description:
					'Read the group types this tenant accepts — the slug to send and the label a person sees',
				routing: {
					request: { method: 'GET', url: '/groups/types' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Set External Ref',
				value: 'setExternalRef',
				action: 'Link a group to an external ID',
				description:
					'Record that your integration knows this group under an external ID. Writes the mapping and nothing else.',
				routing: {
					request: { method: 'PUT', url: '=/groups/{{$parameter.groupId}}/external-ref' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'getAll',
	},

	{
		displayName:
			'Groups can be created and mapped through the API, but not changed: renaming, re-typing, archiving and membership decide who sees what and stay in Kibi. Anything that runs repeatedly should look the group up by its external ID first — Create has no memory and makes a second group on the second run.',
		name: 'readOnlyNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['create'] } },
	},

	ulidField(
		'Group ID',
		'groupId',
		R,
		['get', 'getPosts', 'getMembers', 'getFiles', 'getFolders', 'setExternalRef', 'deleteExternalRef'],
		'The group to act on.',
	),
	externalIdField(R, ['setExternalRef']),

	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Neubau Halle 4',
		description: 'The name of the group',
		displayOptions: { show: { ...show, operation: ['create'] } },
		routing: { request: { body: { name: '={{ $value }}' } } },
	},

	{
		displayName: 'Group Type Name or ID',
		name: 'typeSlug',
		type: 'options',
		typeOptions: { loadOptionsMethod: 'getGroupTypes' },
		default: '',
		description:
			'The type of group, as the slug Kibi expects. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
		hint: 'Leave empty for the tenant default. Tenant-defined types appear here too — they are not guessable.',
		displayOptions: { show: { ...show, operation: ['create'] } },
		routing: { request: { body: { type_slug: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'What the group is for. Plain text.',
		displayOptions: { show: { ...show, operation: ['create'] } },
		routing: { request: { body: { description: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Visibility',
		name: 'visibility',
		type: 'options',
		default: 'all',
		description:
			'Who finds the group. All means everyone who may see groups; Members hides it from everyone but its members.',
		options: [
			{ name: 'All', value: 'all', description: 'Everyone who may see groups finds this one' },
			{ name: 'Members', value: 'members', description: 'Hidden from everyone but its members' },
		],
		displayOptions: { show: { ...show, operation: ['create'] } },
		routing: { request: { body: { visibility: '={{ $value }}' } } },
	},

	{
		displayName: 'External ID',
		name: 'createExternalId',
		type: 'string',
		default: '',
		placeholder: 'P-2026-0815',
		description:
			'Your own stable identifier for this group in the source system — an ERP project number, a cost centre. Optional: without it the group is only addressable by the Kibi ID returned here.',
		hint: 'Unique per integration across the whole tenant and across resource types. Reusing an ID that belongs to another record answers 409.',
		displayOptions: { show: { ...show, operation: ['create'] } },
		routing: { request: { body: { external_id: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		description: 'Filter by name, case-insensitively',
		displayOptions: { show: { ...show, operation: ['getAll', 'getPosts', 'getMembers'] } },
		routing: { request: { qs: { search: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Filter by External ID',
		name: 'filterExternalId',
		type: 'string',
		default: '',
		description:
			'Return only the group mapped to this external ID. The answer stays a list holding one entry or none — an unknown ID is an empty list, not an error.',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { external_id: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Folder ID',
		name: 'folderId',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description:
			'List this folder instead of the whole file area. Take the ID from Get Folders. Leave empty for the group root.',
		displayOptions: { show: { ...show, operation: ['getFiles'] } },
		routing: { request: { qs: { folder: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Include Subfolders',
		name: 'recursive',
		type: 'boolean',
		default: true,
		description:
			'Whether to include the files of subfolders. Without a Folder ID, turning this off lists only the files lying directly in the group root.',
		displayOptions: { show: { ...show, operation: ['getFiles'] } },
		routing: { request: { qs: { recursive: '={{ $value ? "1" : "0" }}' } } },
	},

	...changeScanFields(R, 'getAll'),
	...returnAll(R, 'getAll'),
	...returnAll(R, 'getPosts'),
	...returnAll(R, 'getMembers'),
	...returnAll(R, 'getFiles'),
];
