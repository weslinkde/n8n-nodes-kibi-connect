import type { INodeProperties } from 'n8n-workflow';

import { FILES_BASE_URL, filesReturnAll, unwrapData } from '../../shared/descriptions';
import { ulidField } from '../../shared/fields';
import { contextFields, itemListFilters } from '../file/shared';

const R = 'folder';
const show = { resource: [R] };

/**
 * Folders of the file manager — the Files API under `/api/v2/files`.
 *
 * Reads need the `files:read` scope, writes `files:write`. Folders and items
 * the token owner cannot see answer 404, exactly like unknown IDs, so that
 * nothing can be enumerated from outside.
 */
export const folderDescription: INodeProperties[] = [
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
				action: 'Create a folder',
				description: 'Add a folder at the library root or inside another folder',
				routing: {
					request: { method: 'POST', url: '/files/folders', baseURL: FILES_BASE_URL },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Create Share Link',
				value: 'createShareLink',
				action: 'Create a share link for a folder',
				description:
					'Mint a public link for the folder — read-only, or an upload drop for anonymous visitors',
				routing: {
					request: {
						method: 'POST',
						url: '=/files/folders/{{$parameter.folderId}}/share-links',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a folder',
				description:
					'Delete the folder including everything in it. The files inside are destroyed for good: they show up in the trash, but their binaries are gone and cannot be restored.',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/files/folders/{{$parameter.folderId}}',
						baseURL: FILES_BASE_URL,
					},
					output: {
						postReceive: [{ type: 'set', properties: { value: '={{ { "deleted": true } }}' } }],
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a folder',
				description: 'Read one folder with its breadcrumb and direct subfolders',
				routing: {
					request: {
						method: 'GET',
						url: '=/files/folders/{{$parameter.folderId}}',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Items',
				value: 'getItems',
				action: 'Get the files in a folder',
				description: 'List the files directly inside one folder',
				routing: {
					request: {
						method: 'GET',
						url: '=/files/folders/{{$parameter.folderId}}/items',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Root',
				value: 'getRoot',
				action: 'Get the library root',
				description:
					'Read the virtual root of the file manager: its top-level folders and what the token owner may do there',
				routing: {
					request: { method: 'GET', url: '/files/root', baseURL: FILES_BASE_URL },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Share Links',
				value: 'getShareLinks',
				action: 'Get the share links of a folder',
				description: 'List every share link of the folder — active, expired and revoked',
				routing: {
					request: {
						method: 'GET',
						url: '=/files/folders/{{$parameter.folderId}}/share-links',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Tree',
				value: 'getTree',
				action: 'Get the folder tree',
				description:
					'Read the whole accessible folder tree in one go, nested. Folders whose parent the token owner cannot see appear as additional roots.',
				routing: {
					request: { method: 'GET', url: '/files/folders', baseURL: FILES_BASE_URL },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Star',
				value: 'star',
				action: 'Star a folder',
				description: 'Mark the folder as a favorite of the token owner. Idempotent.',
				routing: {
					request: {
						method: 'PUT',
						url: '=/files/folders/{{$parameter.folderId}}/favorite',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Unstar',
				value: 'unstar',
				action: 'Unstar a folder',
				description: 'Remove the folder from the favorites of the token owner. Idempotent.',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/files/folders/{{$parameter.folderId}}/favorite',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a folder',
				description: 'Rename the folder and/or move it under another parent',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/files/folders/{{$parameter.folderId}}',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'getItems',
	},

	{
		displayName:
			'Folder operations need an API token with the files:read scope; Create, Update, Delete, Create Share Link, Star and Unstar need files:write as well.',
		name: 'scopeNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['getTree', 'getRoot', 'create'] } },
	},

	ulidField(
		'Folder ID',
		'folderId',
		R,
		['get', 'getItems', 'update', 'delete', 'getShareLinks', 'createShareLink', 'star', 'unstar'],
		'The folder to act on. Get Tree and Get Root list the IDs.',
	),

	// ----- create -----
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Contracts 2026',
		description: 'The folder name, up to 255 characters',
		displayOptions: { show: { ...show, operation: ['create'] } },
		routing: { request: { body: { name: '={{ $value }}' } } },
	},
	{
		displayName: 'Parent Folder ID',
		name: 'parentFolderId',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description: 'Where to create the folder. Leave empty for the library root.',
		displayOptions: { show: { ...show, operation: ['create'] } },
		routing: { request: { body: { parent_ulid: '={{ $value || undefined }}' } } },
	},
	...contextFields(R, ['create']),

	// ----- update -----
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		description: 'Only the fields you add are changed',
		displayOptions: { show: { ...show, operation: ['update'] } },
		options: [
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description: 'The new folder name, up to 255 characters',
				routing: { request: { body: { name: '={{ $value }}' } } },
			},
			{
				displayName: 'Parent Folder ID',
				name: 'parentFolderId',
				type: 'string',
				default: '',
				placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
				description:
					'Move the folder under this parent. Leave empty to move it to the library root. Moving a folder into itself or one of its descendants is refused.',
				routing: { request: { body: { parent_ulid: '={{ $value || null }}' } } },
			},
		],
	},

	// ----- getItems -----
	...itemListFilters(R, ['getItems']),

	// ----- createShareLink -----
	{
		displayName: 'Link Type',
		name: 'shareLinkType',
		type: 'options',
		default: 'share',
		description: 'What visitors of the link may do',
		options: [
			{
				name: 'Share',
				value: 'share',
				description: 'A read-only view of the folder with downloads',
			},
			{
				name: 'Upload',
				value: 'upload',
				description: 'An anonymous drop box: visitors can upload into the folder but see nothing',
			},
		],
		displayOptions: { show: { ...show, operation: ['createShareLink'] } },
		routing: { request: { body: { type: '={{ $value }}' } } },
	},
	{
		displayName: 'Expires At',
		name: 'expiresAt',
		type: 'dateTime',
		default: '',
		description:
			'When the link stops working. Must lie in the future. Leave empty for a link without expiry.',
		displayOptions: { show: { ...show, operation: ['createShareLink'] } },
		routing: {
			request: {
				body: { expires_at: '={{ $value ? new Date($value).toISOString() : null }}' },
			},
		},
	},
	{
		displayName: 'Password',
		name: 'password',
		type: 'string',
		typeOptions: { password: true },
		default: '',
		description:
			'Protect the link with a password of at least 6 characters. Leave empty for no password. The password never comes back from the API — only whether one is set.',
		displayOptions: { show: { ...show, operation: ['createShareLink'] } },
		routing: { request: { body: { password: '={{ $value || null }}' } } },
	},
	{
		displayName: 'Notify on Upload',
		name: 'notify',
		type: 'boolean',
		default: false,
		description:
			'Whether to notify the link creator whenever a visitor uploads through the link. Only meaningful for upload links.',
		displayOptions: { show: { ...show, operation: ['createShareLink'] } },
		routing: { request: { body: { notify: '={{ $value }}' } } },
	},

	...filesReturnAll(R, 'getItems', 'page'),
];
