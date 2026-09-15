import type { INodeProperties } from 'n8n-workflow';

import { returnAll, unwrapData } from '../../shared/descriptions';
import {
	changeScanFields,
	conditionalWriteField,
	contentFormatField,
	externalIdField,
	readFormatField,
	ulidField,
} from '../../shared/fields';

const R = 'post';
const show = { resource: [R] };

const writeOps = ['create', 'update', 'upsertByExternalId'];

export const postDescription: INodeProperties[] = [
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
				action: 'Create a post',
				description: 'Publish to the feed. Calling this twice publishes twice.',
				routing: {
					request: { method: 'POST', url: '/posts' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a post',
				description: 'Move a post to the bin',
				routing: {
					request: { method: 'DELETE', url: '=/posts/{{$parameter.postId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete External Ref',
				value: 'deleteExternalRef',
				action: 'Unlink a post from its external ID',
				description: 'Release the external ID without touching the post itself',
				routing: {
					request: { method: 'DELETE', url: '=/posts/{{$parameter.postId}}/external-ref' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a post',
				description: 'Read one post',
				routing: {
					request: { method: 'GET', url: '=/posts/{{$parameter.postId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many posts',
				description: 'Read the published posts visible to the token owner',
				routing: {
					request: { method: 'GET', url: '/posts' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a post',
				description: 'Change an existing post',
				routing: {
					request: { method: 'PUT', url: '=/posts/{{$parameter.postId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Upsert by External ID',
				value: 'upsertByExternalId',
				action: 'Create or update a post by external ID',
				description: 'Create the post, or update the one already mapped to this ID',
				routing: {
					request: { method: 'PUT', url: '/posts/by-external-id' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'upsertByExternalId',
	},

	{
		displayName:
			'Use Upsert by External ID for anything that runs repeatedly. Create has no memory: run the same workflow twice and the feed carries the same announcement twice.',
		name: 'upsertNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['create'] } },
	},

	ulidField(
		'Post ID',
		'postId',
		R,
		['get', 'update', 'delete', 'deleteExternalRef'],
		'The post to act on.',
	),
	externalIdField(R, ['upsertByExternalId']),

	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'New canteen opening hours',
		description: 'The headline of the post',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { title: '={{ $value }}' } } },
	},

	{
		displayName: 'Body',
		name: 'body',
		type: 'string',
		typeOptions: { rows: 6 },
		default: '',
		description:
			'The post content. Rich text — set Content Format to say how it is written. On an upsert, leaving this empty keeps the existing body.',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { body: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'published',
		description: 'Whether the post goes live or stays a draft',
		options: [
			{ name: 'Draft', value: 'draft' },
			{ name: 'Published', value: 'published' },
		],
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { status: '={{ $value }}' } } },
	},

	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description:
			'Publish into one group rather than the whole tenant. On an upsert this is only read when the post is created — it will not move an existing post.',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { group_id: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Announce',
		name: 'notify',
		type: 'boolean',
		default: true,
		description:
			'Whether to announce the post to everyone it reaches. Turn this off for a bulk import — otherwise the first run notifies the entire tenant once per post.',
		displayOptions: { show: { ...show, operation: ['upsertByExternalId'] } },
		routing: { request: { body: { notify: '={{ $value }}' } } },
	},

	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		description: 'Filter posts by title or body, case-insensitively',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { search: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Filter by External ID',
		name: 'filterExternalId',
		type: 'string',
		default: '',
		description:
			'Return only the post mapped to this external ID. The answer stays a list holding one entry or none — an unknown ID is an empty list, not an error.',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { external_id: '={{ $value || undefined }}' } } },
	},

	contentFormatField(R, writeOps),
	readFormatField(R, ['get', 'getAll']),
	conditionalWriteField(R, ['update', 'upsertByExternalId']),
	...changeScanFields(R, 'getAll'),
	...returnAll(R, 'getAll'),
];
