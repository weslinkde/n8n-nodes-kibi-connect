import type { INodeProperties } from 'n8n-workflow';

import { downloadBinary, uploadBinary } from '../../shared/binary';
import { FILES_BASE_URL, filesReturnAll, unwrapData } from '../../shared/descriptions';
import { DATE_TIME_HINT, ulidField } from '../../shared/fields';
import { contextFields, itemListFilters } from './shared';

const R = 'file';
const show = { resource: [R] };

/**
 * Downloads come through the authenticated endpoint with `?stream=1`.
 *
 * Without it the API answers 302 to a presigned object-storage URL, and the
 * request layer would forward the Authorization header to a host that must
 * never see it. Streaming through the app keeps the bytes on the tenant's
 * own domain and lets the Bearer token do its job.
 */
const binaryRequest = {
	qs: { stream: 1 },
	headers: { Accept: '*/*' },
	encoding: 'arraybuffer' as const,
	json: false,
	returnFullResponse: true,
};

/**
 * Files of the file manager — the Files API under `/api/v2/files`.
 *
 * Reads need the `files:read` scope, writes `files:write`. Files the token
 * owner cannot see answer 404, exactly like unknown IDs, so that nothing can
 * be enumerated from outside.
 */
export const fileDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show },
		options: [
			{
				name: 'Attach Link',
				value: 'attachLink',
				action: 'Link a file to a record',
				description:
					'Attach the file to a post, wiki page, contact, company or group. A link is a reference — the target itself is not changed. Deduplicated.',
				routing: {
					request: {
						method: 'POST',
						url: '=/files/items/{{$parameter.fileId}}/links',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Batch Get',
				value: 'batchGet',
				action: 'Get many files by ID',
				description:
					'Read up to 100 files in one request. IDs that are unknown or not visible are silently left out — a missing entry means the file is gone for this token.',
				routing: {
					request: { method: 'POST', url: '/files/items/batch', baseURL: FILES_BASE_URL },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Convert to PDF',
				value: 'convertToPdf',
				action: 'Convert an image to PDF',
				description:
					'Create a PDF from an image file, as a new file in the same folder. Only images can be converted.',
				routing: {
					request: {
						method: 'POST',
						url: '=/files/items/{{$parameter.fileId}}/convert-to-pdf',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Copy to Personal Files',
				value: 'copyToPersonal',
				action: 'Copy a file to the personal folder',
				description:
					'Copy the file into the token owner\'s "My Files" folder for editing. Answers the copy plus a meta block with the editor URL and whether an identical copy already existed. Needs the Office integration to be enabled.',
				routing: {
					request: {
						method: 'POST',
						url: '=/files/items/{{$parameter.fileId}}/copy-to-personal',
						baseURL: FILES_BASE_URL,
					},
				},
			},
			{
				name: 'Create Share Link',
				value: 'createShareLink',
				action: 'Create a share link for a file',
				description:
					'Mint a public, read-only link to this one file. Upload links exist for folders only.',
				routing: {
					request: {
						method: 'POST',
						url: '=/files/items/{{$parameter.fileId}}/share-links',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a file',
				description: 'Move the file to the trash. Restore brings it back.',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/files/items/{{$parameter.fileId}}',
						baseURL: FILES_BASE_URL,
					},
					output: {
						postReceive: [{ type: 'set', properties: { value: '={{ { "deleted": true } }}' } }],
					},
				},
			},
			{
				name: 'Detach Link',
				value: 'detachLink',
				action: 'Unlink a file from a record',
				description:
					'Remove the link between the file and a post, wiki page, contact, company or group',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/files/items/{{$parameter.fileId}}/links',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Download',
				value: 'download',
				action: 'Download a file',
				description: 'Fetch the current content of the file as binary data',
				routing: {
					request: {
						method: 'GET',
						url: '=/files/items/{{$parameter.fileId}}/download',
						baseURL: FILES_BASE_URL,
						...binaryRequest,
					},
					output: { postReceive: [downloadBinary] },
				},
			},
			{
				name: 'Download Version',
				value: 'downloadVersion',
				action: 'Download an old version of a file',
				description: 'Fetch the content of one earlier version as binary data',
				routing: {
					request: {
						method: 'GET',
						url: '=/files/items/{{$parameter.fileId}}/versions/{{$parameter.versionNumber}}/download',
						baseURL: FILES_BASE_URL,
						...binaryRequest,
					},
					output: { postReceive: [downloadBinary] },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a file',
				description: 'Read the metadata of one file, including its links and permissions',
				routing: {
					request: {
						method: 'GET',
						url: '=/files/items/{{$parameter.fileId}}',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Access URL',
				value: 'getAccessUrl',
				action: 'Get a direct URL to a file',
				description:
					'Mint a short-lived URL that points straight at the bytes, for a consumer that cannot send the API token. It authorizes by possession — treat it as a secret while it lives.',
				routing: {
					request: {
						method: 'GET',
						url: '=/files/items/{{$parameter.fileId}}/access',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Activity',
				value: 'getActivity',
				action: 'Get the file activity',
				description:
					'Read the audit trail of the file manager, newest first: uploads, renames, moves, deletions, restores, lock changes. Events are kept for 30 days.',
				routing: {
					request: { method: 'GET', url: '/files/activity', baseURL: FILES_BASE_URL },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Links',
				value: 'getLinks',
				action: 'Get the links of a file',
				description:
					'List the posts, wiki pages, contacts, companies and groups the file is attached to',
				routing: {
					request: {
						method: 'GET',
						url: '=/files/items/{{$parameter.fileId}}/links',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many files',
				description:
					'List the files at the library root — the ones in no folder. Use Get Items on the Folder resource for a folder.',
				routing: {
					request: { method: 'GET', url: '/files/items', baseURL: FILES_BASE_URL },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Recent',
				value: 'getRecent',
				action: 'Get recently changed files',
				description: 'List the accessible files across all folders, most recently updated first',
				routing: {
					request: { method: 'GET', url: '/files/items/recent', baseURL: FILES_BASE_URL },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Share Links',
				value: 'getShareLinks',
				action: 'Get the share links of a file',
				description: 'List every share link of the file — active, expired and revoked',
				routing: {
					request: {
						method: 'GET',
						url: '=/files/items/{{$parameter.fileId}}/share-links',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Trash',
				value: 'getTrash',
				action: 'Get the trashed files',
				description:
					'List the deleted files the token owner may restore, newest deletion first. System administrators and content managers see the whole trash.',
				routing: {
					request: { method: 'GET', url: '/files/trash', baseURL: FILES_BASE_URL },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Versions',
				value: 'getVersions',
				action: 'Get the versions of a file',
				description:
					'List the version history, newest first. A file that was never replaced has no rows — it is implicitly at version 1.',
				routing: {
					request: {
						method: 'GET',
						url: '=/files/items/{{$parameter.fileId}}/versions',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Restore',
				value: 'restore',
				action: 'Restore a file from the trash',
				description: 'Bring a deleted file back from the trash',
				routing: {
					request: {
						method: 'POST',
						url: '=/files/items/{{$parameter.fileId}}/restore',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Restore Version',
				value: 'restoreVersion',
				action: 'Restore an old version of a file',
				description:
					'Promote an earlier version to a new top version. Nothing is rolled back destructively — the history keeps growing.',
				routing: {
					request: {
						method: 'POST',
						url: '=/files/items/{{$parameter.fileId}}/versions/{{$parameter.versionNumber}}/restore',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Search',
				value: 'search',
				action: 'Search files',
				description:
					'Find files by name, caption or alt text across every folder the token owner can see, most recently updated first',
				routing: {
					request: { method: 'GET', url: '/files/search', baseURL: FILES_BASE_URL },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Star',
				value: 'star',
				action: 'Star a file',
				description: 'Mark the file as a favorite of the token owner. Idempotent.',
				routing: {
					request: {
						method: 'PUT',
						url: '=/files/items/{{$parameter.fileId}}/favorite',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Unstar',
				value: 'unstar',
				action: 'Unstar a file',
				description: 'Remove the file from the favorites of the token owner. Idempotent.',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/files/items/{{$parameter.fileId}}/favorite',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a file',
				description: 'Rename or move the file, or change its caption, alt text or template flag',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/files/items/{{$parameter.fileId}}',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Upload',
				value: 'upload',
				action: 'Upload a file',
				description:
					'Upload binary data from the input item as a new file, or as new content of an existing one. Single-shot: files up to 64 MiB. Anything larger needs the chunked upload flow, which this node does not implement.',
				routing: {
					request: { method: 'POST', url: '/files/uploads', baseURL: FILES_BASE_URL },
					send: { preSend: [uploadBinary] },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'upload',
	},

	{
		displayName:
			'File operations need an API token with the files:read scope; everything that writes — Upload, Update, Delete, Restore, Restore Version, Attach Link, Detach Link, Create Share Link, Convert to PDF, Copy to Personal Files, Star and Unstar — needs files:write as well.',
		name: 'scopeNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['upload', 'getAll', 'search'] } },
	},

	ulidField(
		'File ID',
		'fileId',
		R,
		[
			'get',
			'download',
			'getAccessUrl',
			'update',
			'delete',
			'restore',
			'getVersions',
			'downloadVersion',
			'restoreVersion',
			'getShareLinks',
			'createShareLink',
			'star',
			'unstar',
			'convertToPdf',
			'copyToPersonal',
			'getLinks',
			'attachLink',
			'detachLink',
		],
		'The file to act on.',
	),

	// ----- upload -----
	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		description:
			'The name of the binary property on the input item that holds the file. Its file name and MIME type are sent along.',
		hint: 'The file name Kibi stores comes from the binary property, so set it there if the source has none.',
		displayOptions: { show: { ...show, operation: ['upload'] } },
	},
	{
		displayName: 'Folder ID',
		name: 'uploadFolderId',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description:
			'Where to put the file. Leave empty for the library root. Ignored when replacing an existing file.',
		displayOptions: { show: { ...show, operation: ['upload'] } },
		routing: { request: { body: { folder_ulid: '={{ $value || undefined }}' } } },
	},
	{
		displayName: 'Replace File ID',
		name: 'targetItemId',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description:
			'Upload as new content of this existing file instead of creating one. The previous content is kept as a version.',
		displayOptions: { show: { ...show, operation: ['upload'] } },
		routing: { request: { body: { target_item_ulid: '={{ $value || undefined }}' } } },
	},
	{
		displayName: 'Parent Version Number',
		name: 'parentVersionId',
		type: 'number',
		default: 0,
		description:
			'When replacing: the version number you last saw. If the file moved on since, a conflict copy is created next to it rather than overwriting. Leave at 0 to skip the check — last write wins.',
		displayOptions: { show: { ...show, operation: ['upload'] } },
		routing: { request: { body: { parent_version_id: '={{ $value || undefined }}' } } },
	},
	{
		displayName: 'Force Conflict Copy',
		name: 'forceConflictCopy',
		type: 'boolean',
		default: false,
		description:
			'Whether to create a conflict copy instead of failing when the file to replace is locked by someone else',
		displayOptions: { show: { ...show, operation: ['upload'] } },
		routing: { request: { body: { force: '={{ $value ? "conflict_copy" : undefined }}' } } },
	},
	...contextFields(R, ['upload']),

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
				displayName: 'Alt Text',
				name: 'altText',
				type: 'string',
				default: '',
				description: 'Alternative text for images, up to 255 characters. Leave empty to clear it.',
				routing: { request: { body: { alt_text: '={{ $value || null }}' } } },
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				description: 'A caption of up to 255 characters. Leave empty to clear it.',
				routing: { request: { body: { caption: '={{ $value || null }}' } } },
			},
			{
				displayName: 'Folder ID',
				name: 'folderId',
				type: 'string',
				default: '',
				placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
				description: 'Move the file into this folder. Leave empty to move it to the library root.',
				routing: { request: { body: { folder_ulid: '={{ $value || null }}' } } },
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description:
					'The new file name, up to 255 characters. The original extension is always kept — send the stem or the full name.',
				routing: { request: { body: { name: '={{ $value }}' } } },
			},
			{
				displayName: 'Parent Version Number',
				name: 'parentVersionId',
				type: 'number',
				default: 1,
				description:
					'The version number you last saw. If the file has a newer version by now the update is refused with 409 instead of applied.',
				routing: { request: { body: { parent_version_id: '={{ $value }}' } } },
			},
			{
				displayName: 'Template',
				name: 'isTemplate',
				type: 'boolean',
				default: false,
				description:
					'Whether the file is offered as a template. Only PDFs and Office documents can be templates.',
				routing: { request: { body: { is_template: '={{ $value }}' } } },
			},
		],
	},

	// ----- versions -----
	{
		displayName: 'Version Number',
		name: 'versionNumber',
		type: 'number',
		required: true,
		default: 1,
		typeOptions: { minValue: 1 },
		description: 'The version to act on, as listed by Get Versions',
		displayOptions: { show: { ...show, operation: ['downloadVersion', 'restoreVersion'] } },
	},

	// ----- getAccessUrl -----
	{
		displayName: 'Disposition',
		name: 'disposition',
		type: 'options',
		default: 'inline',
		description: 'Whether a browser opening the URL should display the file or save it',
		options: [
			{ name: 'Attachment', value: 'attachment' },
			{ name: 'Inline', value: 'inline' },
		],
		displayOptions: { show: { ...show, operation: ['getAccessUrl'] } },
		routing: {
			request: { qs: { disposition: '={{ $value === "attachment" ? $value : undefined }}' } },
		},
	},

	// ----- search -----
	{
		displayName: 'Search Term',
		name: 'query',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'quarterly report',
		description:
			'Two to 255 characters, matched case-insensitively against name, caption and alt text',
		displayOptions: { show: { ...show, operation: ['search'] } },
		routing: { request: { qs: { q: '={{ $value }}' } } },
	},

	// ----- getActivity -----
	{
		displayName: 'Folder ID',
		name: 'activityFolderId',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description:
			'Limit the trail to one folder. Leave empty for everything the token owner can see.',
		displayOptions: { show: { ...show, operation: ['getActivity'] } },
		routing: { request: { qs: { folder: '={{ $value || undefined }}' } } },
	},

	// ----- batchGet -----
	{
		displayName: 'File IDs',
		name: 'fileIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC, 01J8ZP9K7QW3X2YB5M4N6R8TVD',
		description: 'Up to 100 file IDs, comma-separated. An expression may also hand over an array.',
		displayOptions: { show: { ...show, operation: ['batchGet'] } },
		routing: {
			request: {
				body: {
					ids: '={{ Array.isArray($value) ? $value : String($value).split(",").map(v => v.trim()).filter(v => v) }}',
				},
			},
		},
	},

	// ----- getAll -----
	...itemListFilters(R, ['getAll']),

	// ----- createShareLink -----
	{
		displayName: 'Expires At',
		name: 'expiresAt',
		type: 'dateTime',
		default: '',
		description:
			'When the link stops working. Must lie in the future. Leave empty for a link without expiry.',
		hint: DATE_TIME_HINT,
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

	// ----- attachLink / detachLink -----
	{
		displayName: 'Record Type',
		name: 'linkModelType',
		type: 'options',
		default: 'post',
		description: 'What kind of record the file is linked to',
		options: [
			{ name: 'Company', value: 'company' },
			{ name: 'Contact', value: 'contact' },
			{ name: 'Group', value: 'group' },
			{ name: 'Post', value: 'post' },
			{ name: 'Wiki Page', value: 'wiki' },
		],
		displayOptions: { show: { ...show, operation: ['attachLink', 'detachLink'] } },
		routing: {
			request: {
				body: {
					model_type: '={{ $value }}',
					// The pivot's media type is fixed per target kind, so it is
					// derived here rather than asked for and got wrong.
					media_type:
						'={{ $value === "post" ? "images" : $value === "wiki" ? "wiki_content_files" : "linked_files" }}',
				},
			},
		},
	},
	{
		displayName: 'Record ID',
		name: 'linkModelId',
		type: 'number',
		required: true,
		default: 0,
		description:
			'The numeric ID of the post, wiki page, contact, company or group. Linking to a post or wiki page requires permission to edit it; the others only need to be visible.',
		displayOptions: { show: { ...show, operation: ['attachLink', 'detachLink'] } },
		routing: { request: { body: { model_id: '={{ $value }}' } } },
	},

	...filesReturnAll(R, 'getAll'),
	...filesReturnAll(R, 'getRecent'),
	...filesReturnAll(R, 'search'),
	...filesReturnAll(R, 'getTrash'),
	...filesReturnAll(R, 'getActivity'),
];
