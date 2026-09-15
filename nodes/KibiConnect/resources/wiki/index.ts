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

const R = 'wiki';
const show = { resource: [R] };

const writeOps = ['create', 'update', 'upsertByExternalId'];

export const wikiDescription: INodeProperties[] = [
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
				action: 'Create a wiki page',
				description: 'Add a page. Calling this twice creates two pages.',
				routing: {
					request: { method: 'POST', url: '/wiki' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a wiki page',
				description: 'Move a page to the bin',
				routing: {
					request: { method: 'DELETE', url: '=/wiki/{{$parameter.pageId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete External Ref',
				value: 'deleteExternalRef',
				action: 'Unlink a wiki page from its external ID',
				description: 'Release the external ID without touching the page itself',
				routing: {
					request: { method: 'DELETE', url: '=/wiki/{{$parameter.pageId}}/external-ref' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a wiki page',
				description: 'Read one page',
				routing: {
					request: { method: 'GET', url: '=/wiki/{{$parameter.pageId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many wiki pages',
				description: 'Read the pages visible to the token owner',
				routing: {
					request: { method: 'GET', url: '/wiki' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a wiki page',
				description: 'Change an existing page',
				routing: {
					request: { method: 'PUT', url: '=/wiki/{{$parameter.pageId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Upsert by External ID',
				value: 'upsertByExternalId',
				action: 'Create or update a wiki page by external ID',
				description: 'Create the page, or update the one already mapped to this ID',
				routing: {
					request: { method: 'PUT', url: '/wiki/by-external-id' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'upsertByExternalId',
	},

	{
		displayName:
			'Use Upsert by External ID for anything that runs repeatedly — mirroring a docs folder, say. Create has no memory: run it twice and the wiki carries the same page twice.',
		name: 'upsertNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['create'] } },
	},

	ulidField(
		'Page ID',
		'pageId',
		R,
		['get', 'update', 'delete', 'deleteExternalRef'],
		'The wiki page to act on.',
	),
	externalIdField(R, ['upsertByExternalId']),

	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Onboarding checklist',
		description: 'The page title',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { title: '={{ $value }}' } } },
	},

	{
		displayName: 'Content',
		name: 'content',
		type: 'string',
		typeOptions: { rows: 8 },
		default: '',
		description:
			'The page content. Rich text — set Content Format to say how it is written. On an upsert, leaving this empty keeps the existing content.',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { content: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'published',
		description: 'Whether the page is visible or still a draft',
		options: [
			{ name: 'Draft', value: 'draft' },
			{ name: 'Published', value: 'published' },
		],
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { status: '={{ $value }}' } } },
	},

	{
		displayName: 'Parent Page ID',
		name: 'parentId',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description: 'Nest this page under another one. Only read when the page is created.',
		displayOptions: { show: { ...show, operation: ['create'] } },
		routing: { request: { body: { parent_id: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		description: 'Filter pages by title or content, case-insensitively',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { search: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Filter by External ID',
		name: 'filterExternalId',
		type: 'string',
		default: '',
		description:
			'Return only the page mapped to this external ID. The answer stays a list holding one entry or none — an unknown ID is an empty list, not an error.',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { external_id: '={{ $value || undefined }}' } } },
	},

	contentFormatField(R, writeOps),
	readFormatField(R, ['get', 'getAll']),
	conditionalWriteField(R, ['update', 'upsertByExternalId']),
	...changeScanFields(R, 'getAll'),
	...returnAll(R, 'getAll'),
];
