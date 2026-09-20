import type { INodeProperties } from 'n8n-workflow';

import { FILES_BASE_URL, filesReturnAll, unwrapData } from '../../shared/descriptions';
import { DATE_TIME_HINT, ulidField } from '../../shared/fields';

const R = 'shareLink';
const show = { resource: [R] };

/**
 * Public share and upload links of the file manager — `/api/v2/files/share-links`.
 *
 * A link's ULID is a capability token: whoever has the URL may use it within
 * the link's constraints (expiry, password, revocation). Links are created
 * on a folder or a file (see those resources); this resource manages the
 * links that exist. Reads need `files:read`, writes `files:write`.
 */
export const shareLinkDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show },
		options: [
			{
				name: 'Get Accesses',
				value: 'getAccesses',
				action: 'Get the access log of a share link',
				description:
					'What visitors did with the link: page views, downloads, uploads and failed password attempts, newest first',
				routing: {
					request: {
						method: 'GET',
						url: '=/files/share-links/{{$parameter.shareLinkId}}/accesses',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many share links',
				description:
					'List the share links the token owner created, across folders and files and in every status',
				routing: {
					request: { method: 'GET', url: '/files/share-links', baseURL: FILES_BASE_URL },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Revoke',
				value: 'revoke',
				action: 'Revoke a share link',
				description:
					'Switch the link off for good. Revocation is soft — the link stays on record for the audit trail — and idempotent.',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/files/share-links/{{$parameter.shareLinkId}}',
						baseURL: FILES_BASE_URL,
					},
					output: {
						postReceive: [{ type: 'set', properties: { value: '={{ { "revoked": true } }}' } }],
					},
				},
			},
			{
				name: 'Send',
				value: 'send',
				action: 'Email a share link',
				description:
					'Mail the link to external recipients from Kibi, with an optional message. Limited to 20 recipients per hour per user.',
				routing: {
					request: {
						method: 'POST',
						url: '=/files/share-links/{{$parameter.shareLinkId}}/send',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a share link',
				description: 'Change the expiry, the password or the upload notification of a link',
				routing: {
					request: {
						method: 'PATCH',
						url: '=/files/share-links/{{$parameter.shareLinkId}}',
						baseURL: FILES_BASE_URL,
					},
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'getAll',
	},

	{
		displayName:
			'Share link operations need an API token with the files:read scope; Update, Revoke and Send need files:write as well. To create a link, use Create Share Link on the Folder or File resource.',
		name: 'scopeNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
	},

	ulidField(
		'Share Link ID',
		'shareLinkId',
		R,
		['update', 'revoke', 'getAccesses', 'send'],
		'The share link to act on. Get Many lists the IDs.',
	),

	// ----- getAll -----
	{
		displayName: 'Filter by Type',
		name: 'filterType',
		type: 'options',
		default: '',
		description: 'Return only links of this kind',
		options: [
			{ name: 'Any', value: '' },
			{ name: 'Share', value: 'share' },
			{ name: 'Upload', value: 'upload' },
		],
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { type: '={{ $value || undefined }}' } } },
	},
	{
		displayName: 'Filter by Status',
		name: 'filterStatus',
		type: 'options',
		default: '',
		description: 'Return only links in this state',
		options: [
			{ name: 'Active', value: 'active' },
			{ name: 'Any', value: '' },
			{ name: 'Expired', value: 'expired' },
			{ name: 'Revoked', value: 'revoked' },
		],
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { status: '={{ $value || undefined }}' } } },
	},
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		description:
			'Filter by the name of what the link points at — the folder name for folder links, the file name for file links',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { q: '={{ $value || undefined }}' } } },
	},
	{
		displayName: 'Whole Tenant',
		name: 'scopeAll',
		type: 'boolean',
		default: false,
		description:
			"Whether to list every link in the tenant instead of the token owner's own. Only a system administrator's token may do this — anyone else gets 403.",
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { scope: '={{ $value ? "all" : undefined }}' } } },
	},

	// ----- getAccesses -----
	{
		displayName: 'Filter by Access Type',
		name: 'filterAccessType',
		type: 'options',
		default: '',
		description:
			'Return only one kind of access. The per-type totals in the first page come back unfiltered either way.',
		options: [
			{ name: 'Any', value: '' },
			{ name: 'Download', value: 'download' },
			{ name: 'Failed Unlock', value: 'unlock_failed' },
			{ name: 'Upload', value: 'upload' },
			{ name: 'View', value: 'view' },
		],
		displayOptions: { show: { ...show, operation: ['getAccesses'] } },
		routing: { request: { qs: { type: '={{ $value || undefined }}' } } },
	},

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
				displayName: 'Expires At',
				name: 'expiresAt',
				type: 'dateTime',
				default: '',
				description:
					'When the link stops working. Must lie in the future. Leave empty to remove the expiry.',
				hint: DATE_TIME_HINT,
				routing: {
					request: {
						body: { expires_at: '={{ $value ? new Date($value).toISOString() : null }}' },
					},
				},
			},
			{
				displayName: 'Notify on Upload',
				name: 'notify',
				type: 'boolean',
				default: false,
				description:
					'Whether to notify the link creator whenever a visitor uploads through the link. Only meaningful for upload links.',
				routing: { request: { body: { notify: '={{ $value }}' } } },
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description:
					'Replace the password (at least 6 characters). Leave empty to remove the password. Not adding this field keeps the current one.',
				routing: { request: { body: { password: '={{ $value || null }}' } } },
			},
		],
	},

	// ----- send -----
	{
		displayName: 'Recipients',
		name: 'emails',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'anna@example.com, ben@example.com',
		description:
			'One to ten email addresses, comma-separated. An expression may also hand over an array.',
		displayOptions: { show: { ...show, operation: ['send'] } },
		routing: {
			request: {
				body: {
					emails:
						'={{ Array.isArray($value) ? $value : String($value).split(",").map(v => v.trim()).filter(v => v) }}',
				},
			},
		},
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description:
			'A personal note for the mail, up to 1000 characters. Plain text — HTML is escaped.',
		displayOptions: { show: { ...show, operation: ['send'] } },
		routing: { request: { body: { message: '={{ $value || undefined }}' } } },
	},

	...filesReturnAll(R, 'getAll'),
	...filesReturnAll(R, 'getAccesses'),
];
