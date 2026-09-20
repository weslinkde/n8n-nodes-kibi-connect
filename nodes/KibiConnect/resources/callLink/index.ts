import type { INodeProperties } from 'n8n-workflow';

import { returnAll, unwrapData } from '../../shared/descriptions';
import { DATE_TIME_HINT, conditionalWriteField, ulidField } from '../../shared/fields';

const R = 'callLink';
const show = { resource: [R] };

export const callLinkDescription: INodeProperties[] = [
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
				action: 'Create a call link',
				description:
					'Create a meeting link that guests open without a Kibi account. Map it to your external ID to reschedule or cancel it later.',
				routing: {
					request: { method: 'POST', url: '/call/links' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Deactivate a call link',
				description:
					'Deactivate a link: it stops admitting anyone, but a call that already happened keeps its recording and minutes',
				routing: {
					request: { method: 'DELETE', url: '=/call/links/{{$parameter.callLinkId}}' },
				},
			},
			{
				name: 'Delete External Ref',
				value: 'deleteExternalRef',
				action: 'Unlink a call link from its external ID',
				description: 'Release the external ID for a new link without touching the link itself',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/call/links/{{$parameter.callLinkId}}/external-ref',
					},
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a call link',
				description: 'Read one meeting link by its Kibi ID',
				routing: {
					request: { method: 'GET', url: '=/call/links/{{$parameter.callLinkId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many call links',
				description:
					'Read the links this integration mapped to its own namespace, newest first — not every link in the tenant',
				routing: {
					request: { method: 'GET', url: '/call/links' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a call link',
				description:
					'Reschedule a link: move the time, adjust the duration, push the expiry out. Host, type and visibility are fixed at creation.',
				routing: {
					request: { method: 'PUT', url: '=/call/links/{{$parameter.callLinkId}}' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'create',
	},

	{
		displayName:
			'A deactivated link keeps its external mapping, so a cancelled appointment that is rebooked under the same ID is refused with 409 rather than silently reusing a dead link. Release the ID with Delete External Ref first if you want to reuse it.',
		name: 'deactivateNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['delete'] } },
	},

	ulidField(
		'Call Link ID',
		'callLinkId',
		R,
		['get', 'update', 'delete', 'deleteExternalRef'],
		'The meeting link to act on, by its Kibi ID. To find a link by your own ID, filter Get Many by external ID.',
	),

	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Kick-off with the customer',
		description: 'The title of the meeting',
		displayOptions: { show: { ...show, operation: ['create'] } },
		routing: { request: { body: { title: '={{ $value }}' } } },
	},

	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...show, operation: ['create'] } },
		options: [
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'What the meeting is about',
				routing: { request: { body: { description: '={{ $value }}' } } },
			},
			{
				displayName: 'Duration (Minutes)',
				name: 'durationMinutes',
				type: 'number',
				default: 60,
				description: 'How long the meeting is planned to last',
				routing: { request: { body: { duration_minutes: '={{ $value }}' } } },
			},
			{
				displayName: 'Expires At',
				name: 'expiresAt',
				type: 'dateTime',
				default: '',
				description:
					'When the link stops working. A one-time link with a scheduled time expires an hour after the meeting ends unless set here.',
				hint: DATE_TIME_HINT,
				routing: {
					request: {
						body: { expires_at: '={{ $value ? new Date($value).toISOString() : undefined }}' },
					},
				},
			},
			{
				displayName: 'External ID',
				name: 'externalId',
				type: 'string',
				default: '',
				placeholder: 'APPT-2026-0815',
				description:
					"The appointment's ID in the calling system. Without it the link is only addressable by the Kibi ID returned here. Unique per integration across the whole tenant — a second link for the same appointment is refused with 409.",
				routing: { request: { body: { external_id: '={{ $value }}' } } },
			},
			{
				displayName: 'Guests Allowed',
				name: 'guestsAllowed',
				type: 'boolean',
				default: true,
				description: 'Whether people without a Kibi account may join',
				routing: { request: { body: { guests_allowed: '={{ $value }}' } } },
			},
			{
				displayName: 'Host Email',
				name: 'hostEmail',
				type: 'string',
				default: '',
				placeholder: 'name@example.com',
				description:
					'Who holds the meeting — not who owns the token. The link then belongs in the meeting list of that person. Without it the link belongs to the token owner.',
				routing: { request: { body: { host_email: '={{ $value }}' } } },
			},
			{
				displayName: 'Max Participants',
				name: 'maxParticipants',
				type: 'number',
				default: 10,
				description: 'How many people may be in the call at once',
				routing: { request: { body: { max_participants: '={{ $value }}' } } },
			},
			{
				displayName: 'Scheduled At',
				name: 'scheduledAt',
				type: 'dateTime',
				default: '',
				description: 'When the meeting takes place',
				hint: DATE_TIME_HINT,
				routing: {
					request: {
						body: { scheduled_at: '={{ $value ? new Date($value).toISOString() : undefined }}' },
					},
				},
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: 'one_time',
				description: 'Whether the link is for one meeting or stays open for repeated use',
				options: [
					{ name: 'One Time', value: 'one_time' },
					{ name: 'Persistent', value: 'persistent' },
				],
				routing: { request: { body: { type: '={{ $value }}' } } },
			},
			{
				displayName: 'Visibility',
				name: 'visibility',
				type: 'options',
				default: 'private',
				description: 'Whether the link is listed for everyone in the tenant or only for those who have it',
				options: [
					{ name: 'Private', value: 'private' },
					{ name: 'Public', value: 'public' },
				],
				routing: { request: { body: { visibility: '={{ $value }}' } } },
			},
			{
				displayName: 'Waiting Room',
				name: 'waitingRoom',
				type: 'boolean',
				default: false,
				description: 'Whether participants wait until the host lets them in',
				routing: { request: { body: { waiting_room: '={{ $value }}' } } },
			},
		],
	},

	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...show, operation: ['update'] } },
		options: [
			{
				displayName: 'Active',
				name: 'isActive',
				type: 'boolean',
				default: true,
				description: 'Whether the link admits participants',
				routing: { request: { body: { is_active: '={{ $value }}' } } },
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				description: 'What the meeting is about',
				routing: { request: { body: { description: '={{ $value }}' } } },
			},
			{
				displayName: 'Duration (Minutes)',
				name: 'durationMinutes',
				type: 'number',
				default: 60,
				description: 'How long the meeting is planned to last',
				routing: { request: { body: { duration_minutes: '={{ $value }}' } } },
			},
			{
				displayName: 'Expires At',
				name: 'expiresAt',
				type: 'dateTime',
				default: '',
				description: 'When the link stops working',
				hint: DATE_TIME_HINT,
				routing: {
					request: {
						body: { expires_at: '={{ $value ? new Date($value).toISOString() : undefined }}' },
					},
				},
			},
			{
				displayName: 'Scheduled At',
				name: 'scheduledAt',
				type: 'dateTime',
				default: '',
				description: 'When the meeting takes place',
				hint: DATE_TIME_HINT,
				routing: {
					request: {
						body: { scheduled_at: '={{ $value ? new Date($value).toISOString() : undefined }}' },
					},
				},
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'The title of the meeting',
				routing: { request: { body: { title: '={{ $value }}' } } },
			},
		],
	},

	{
		displayName: 'Filter by External ID',
		name: 'filterExternalId',
		type: 'string',
		default: '',
		description:
			'Return only the link mapped to this external ID. The answer stays a list holding one entry or none — an unknown ID is an empty list, not an error.',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { external_id: '={{ $value || undefined }}' } } },
	},

	conditionalWriteField(R, ['update']),
	...returnAll(R, 'getAll'),
];
