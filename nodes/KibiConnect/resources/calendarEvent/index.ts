import type { INodeProperties } from 'n8n-workflow';

import { returnAll, unwrapData } from '../../shared/descriptions';
import {
	changeScanFields,
	conditionalWriteField,
	externalIdField,
	ulidField,
} from '../../shared/fields';

const R = 'calendarEvent';
const show = { resource: [R] };

const writeOps = ['create', 'update', 'upsertByExternalId'];

export const calendarEventDescription: INodeProperties[] = [
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
				action: 'Create a calendar event',
				description: 'Add an event. Calling this twice creates two events.',
				routing: {
					request: { method: 'POST', url: '/calendar/events' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a calendar event',
				description: 'Remove an event permanently. There is no bin for these.',
				routing: {
					request: { method: 'DELETE', url: '=/calendar/events/{{$parameter.eventId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a calendar event',
				description: 'Read one event',
				routing: {
					request: { method: 'GET', url: '=/calendar/events/{{$parameter.eventId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many calendar events',
				description: 'Read the events visible to the token owner',
				routing: {
					request: { method: 'GET', url: '/calendar/events' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a calendar event',
				description: 'Change an event the token owner created',
				routing: {
					request: { method: 'PUT', url: '=/calendar/events/{{$parameter.eventId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Upsert by External ID',
				value: 'upsertByExternalId',
				action: 'Create or update a calendar event by external ID',
				description: 'Create the event, or update the one already mapped to this ID',
				routing: {
					request: { method: 'PUT', url: '/calendar/events/by-external-id' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'upsertByExternalId',
	},

	// The single most expensive thing to not know about this endpoint.
	{
		displayName:
			'An event without a Visibility is created as Personal — visible to its creator and invited participants only. A workflow mirroring a team calendar that leaves this alone therefore writes every event into the token owner\'s private calendar and nobody else ever sees them. No error, no warning, just an empty shared calendar. Set General for something everyone should see, or Group together with a Group ID.',
		name: 'visibilityNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['create', 'upsertByExternalId'] } },
	},

	{
		displayName:
			'Only the account that created an event may change it. A sync can update the events it imported itself, never one a person made in Kibi.',
		name: 'ownershipNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['update', 'upsertByExternalId'] } },
	},

	{
		displayName:
			'Deleting an event is final — unlike posts, tasks and wiki pages it has no bin, so its external ID is released immediately and can be reused.',
		name: 'deleteNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['delete'] } },
	},

	ulidField('Event ID', 'eventId', R, ['get', 'update', 'delete'], 'The event to act on.'),
	externalIdField(R, ['upsertByExternalId']),

	{
		displayName: 'Title',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Sprint review',
		description:
			'The event title. Required on every write, updates included — a calendar upsert always carries the full schedule.',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { name: '={{ $value }}' } } },
	},

	{
		displayName: 'Date',
		name: 'day',
		type: 'dateTime',
		required: true,
		default: '',
		description:
			'The day the event falls on. Required on every write, updates included, just like the title.',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: {
			request: { body: { day: '={{ new Date($value).toISOString().slice(0, 10) }}' } },
		},
	},

	{
		displayName: 'All Day',
		name: 'fullDay',
		type: 'boolean',
		default: false,
		description: 'Whether the event covers the whole day rather than a time range',
		hint: 'Either this or a Start Time is required — an event with neither is refused.',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { full_day: '={{ $value }}' } } },
	},

	{
		displayName: 'Start Time',
		name: 'startTime',
		type: 'string',
		default: '',
		placeholder: '09:30',
		description: 'When the event starts, as HH:MM. Required unless All Day is set.',
		displayOptions: { show: { ...show, operation: writeOps, fullDay: [false] } },
		routing: { request: { body: { start_time: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'End Time',
		name: 'endTime',
		type: 'string',
		default: '',
		placeholder: '10:30',
		description: 'When the event ends, as HH:MM',
		displayOptions: { show: { ...show, operation: writeOps, fullDay: [false] } },
		routing: { request: { body: { end_time: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Visibility',
		name: 'type',
		type: 'options',
		default: 'general',
		description:
			'Who can see the event. General means everyone; Personal means the creator and invited participants only; Group restricts it to one group and needs a Group ID.',
		options: [
			{ name: 'General', value: 'general', description: 'Everyone in the tenant' },
			{ name: 'Group', value: 'group', description: 'One group — set the Group ID as well' },
			{ name: 'Personal', value: 'personal', description: 'The creator and invited people only' },
			{ name: 'Resource', value: 'resource', description: 'A bookable resource such as a room' },
		],
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { type: '={{ $value }}' } } },
	},

	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description: 'The group the event belongs to. Required when Visibility is Group.',
		displayOptions: { show: { ...show, operation: writeOps, type: ['group'] } },
		routing: { request: { body: { group_id: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: { rows: 3 },
		default: '',
		description: 'Plain text. Calendar descriptions are not rich text.',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { description: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Location',
		name: 'location',
		type: 'string',
		default: '',
		placeholder: 'Meeting room 2',
		description: 'Where the event takes place',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { location: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'From Date',
		name: 'startDate',
		type: 'dateTime',
		default: '',
		description: 'Only return events on or after this date',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: {
			request: { qs: { start_date: '={{ $value ? new Date($value).toISOString().slice(0, 10) : undefined }}' } },
		},
	},

	{
		displayName: 'To Date',
		name: 'endDate',
		type: 'dateTime',
		default: '',
		description: 'Only return events on or before this date',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: {
			request: { qs: { end_date: '={{ $value ? new Date($value).toISOString().slice(0, 10) : undefined }}' } },
		},
	},

	{
		displayName: 'Filter by External ID',
		name: 'filterExternalId',
		type: 'string',
		default: '',
		description:
			'Return only the event mapped to this external ID. The answer stays a list holding one entry or none.',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { external_id: '={{ $value || undefined }}' } } },
	},

	conditionalWriteField(R, ['update', 'upsertByExternalId']),
	...changeScanFields(R, 'getAll'),
	...returnAll(R, 'getAll'),
];
