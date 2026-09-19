import type { INodeProperties } from 'n8n-workflow';

import { unwrapData } from '../../shared/descriptions';

const R = 'timeTracking';
const show = { resource: [R] };

/** `YYYY-MM-DD` from whatever the date picker or an expression hands over. */
const DAY = '={{ $value ? new Date($value).toISOString().slice(0, 10) : undefined }}';

const ENTRY_TYPE_OPTIONS = [
	{ name: 'Absence', value: 'absence' },
	{ name: 'Break', value: 'break' },
	{ name: 'Work', value: 'work' },
];

const absenceTypeField = (operations: string[], required: boolean): INodeProperties => ({
	displayName: 'Absence Type Name or ID',
	name: 'absenceTypeId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getAbsenceTypes' },
	required,
	default: '',
	description:
		'The kind of absence. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	displayOptions: { show: { ...show, operation: operations } },
	routing: {
		request: {
			body: { absence_type_id: required ? '={{ $value }}' : '={{ $value || undefined }}' },
		},
	},
});

export const timeTrackingDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show },
		options: [
			{
				name: 'Cancel Absence',
				value: 'cancelAbsence',
				action: 'Cancel an absence request',
				description: 'Withdraw an absence request of the token owner',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/time-tracking/absences/{{$parameter.absenceId}}',
					},
				},
			},
			{
				name: 'Clock In',
				value: 'clockIn',
				action: 'Clock in',
				description: 'Start a new active time entry for the token owner',
				routing: {
					request: { method: 'POST', url: '/time-tracking/clock-in' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Clock Out',
				value: 'clockOut',
				action: 'Clock out',
				description: 'Close the currently active time entry of the token owner',
				routing: {
					request: { method: 'POST', url: '/time-tracking/clock-out' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Create Absence',
				value: 'createAbsence',
				action: 'Create an absence request',
				description:
					'Request an absence. Types that need no approval, such as sick notes, are approved on the spot; everything else waits for review.',
				routing: {
					request: { method: 'POST', url: '/time-tracking/absences' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Create Time Entry',
				value: 'createEntry',
				action: 'Create a time entry',
				description: 'Add a manual time entry for the token owner',
				routing: {
					request: { method: 'POST', url: '/time-tracking/entries' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete Time Entry',
				value: 'deleteEntry',
				action: 'Delete a time entry',
				description: 'Move a time entry to the bin',
				routing: {
					request: {
						method: 'DELETE',
						url: '=/time-tracking/entries/{{$parameter.entryId}}',
					},
				},
			},
			{
				name: 'Get Absence',
				value: 'getAbsence',
				action: 'Get an absence request',
				description: 'Read one absence request',
				routing: {
					request: { method: 'GET', url: '=/time-tracking/absences/{{$parameter.absenceId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Absence Types',
				value: 'getAbsenceTypes',
				action: 'Get many absence types',
				description: 'Read the kinds of absence this tenant knows',
				routing: {
					request: { method: 'GET', url: '/time-tracking/absence-types' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Active Time Entry',
				value: 'getActive',
				action: 'Get the active time entry',
				description:
					'Read the entry the token owner is currently clocked into. The data is null when they are not.',
				routing: {
					request: { method: 'GET', url: '/time-tracking/active' },
				},
			},
			{
				name: 'Get Balance',
				value: 'getBalance',
				action: 'Get the time balance',
				description:
					'Read the balance of the token owner for the current month and year, plus the cumulative one',
				routing: {
					request: { method: 'GET', url: '/time-tracking/balance' },
				},
			},
			{
				name: 'Get Many Absences',
				value: 'getAbsences',
				action: 'Get many absence requests',
				description: 'Read the absence requests of the token owner',
				routing: {
					request: { method: 'GET', url: '/time-tracking/absences' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many Time Entries',
				value: 'getEntries',
				action: 'Get many time entries',
				description: 'Read the time entries of the token owner in a date range',
				routing: {
					request: { method: 'GET', url: '/time-tracking/entries' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Monthly Balances',
				value: 'getMonthlyBalances',
				action: 'Get many monthly balances',
				description: 'Read the balance of the token owner for every month of a year',
				routing: {
					request: { method: 'GET', url: '/time-tracking/balance/monthly' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Time Entries of Today',
				value: 'getToday',
				action: 'Get many time entries of today',
				description: 'Read the time entries of the token owner for today',
				routing: {
					request: { method: 'GET', url: '/time-tracking/today' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Time Entry',
				value: 'getEntry',
				action: 'Get a time entry',
				description: 'Read one time entry',
				routing: {
					request: { method: 'GET', url: '=/time-tracking/entries/{{$parameter.entryId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Work Schedules',
				value: 'getWorkSchedules',
				action: 'Get many work schedules',
				description: 'Read every work schedule of the tenant. HR and administrators only.',
				routing: {
					request: { method: 'GET', url: '/time-tracking/work-schedules' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Update Absence',
				value: 'updateAbsence',
				action: 'Update an absence request',
				description: 'Change an absence request. Only pending requests can be changed.',
				routing: {
					request: { method: 'PUT', url: '=/time-tracking/absences/{{$parameter.absenceId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Update Time Entry',
				value: 'updateEntry',
				action: 'Update a time entry',
				description: 'Change an existing time entry',
				routing: {
					request: { method: 'PUT', url: '=/time-tracking/entries/{{$parameter.entryId}}' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'getActive',
	},

	{
		displayName:
			'Requires the Time Tracking module. Kibi answers 404 for every time tracking route when the module is not installed — the same answer as for an unknown ID, on purpose. Everything here acts on the account the token belongs to: a token cannot clock somebody else in.',
		name: 'moduleNotice',
		type: 'notice',
		default: '',
		displayOptions: { show },
	},

	{
		displayName: 'Time Entry ID',
		name: 'entryId',
		type: 'string',
		required: true,
		default: '',
		description: 'The numeric ID of the time entry, as returned by Get Many Time Entries',
		hint: 'Time entries are addressed by a numeric ID, not by a ULID like most other records',
		displayOptions: { show: { ...show, operation: ['getEntry', 'updateEntry', 'deleteEntry'] } },
	},

	{
		displayName: 'Absence ID',
		name: 'absenceId',
		type: 'string',
		required: true,
		default: '',
		description: 'The numeric ID of the absence request, as returned by Get Many Absences',
		hint: 'Absences are addressed by a numeric ID, not by a ULID like most other records',
		displayOptions: {
			show: { ...show, operation: ['getAbsence', 'updateAbsence', 'cancelAbsence'] },
		},
	},

	// Clock in / clock out

	{
		displayName: 'Additional Fields',
		name: 'clockInFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...show, operation: ['clockIn'] } },
		options: [
			{
				displayName: 'Latitude',
				name: 'latitude',
				type: 'number',
				default: 0,
				description:
					'Where the person clocked in. Discarded by Kibi unless the tenant enabled location capture and the person consented.',
				routing: { request: { body: { latitude: '={{ $value }}' } } },
			},
			{
				displayName: 'Longitude',
				name: 'longitude',
				type: 'number',
				default: 0,
				description:
					'Where the person clocked in. Discarded by Kibi unless the tenant enabled location capture and the person consented.',
				routing: { request: { body: { longitude: '={{ $value }}' } } },
			},
			{
				displayName: 'Note',
				name: 'note',
				type: 'string',
				default: '',
				description: 'A remark on the entry',
				routing: { request: { body: { note: '={{ $value }}' } } },
			},
			{
				displayName: 'Project ID',
				name: 'projectId',
				type: 'number',
				default: 0,
				description: 'The numeric ID of the project to book the time on',
				routing: { request: { body: { project_id: '={{ $value }}' } } },
			},
			{
				displayName: 'Task ID',
				name: 'taskId',
				type: 'number',
				default: 0,
				description: 'The numeric ID of the task to book the time on',
				routing: { request: { body: { task_id: '={{ $value }}' } } },
			},
		],
	},

	{
		displayName: 'Additional Fields',
		name: 'clockOutFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...show, operation: ['clockOut'] } },
		options: [
			{
				displayName: 'Latitude',
				name: 'latitude',
				type: 'number',
				default: 0,
				description:
					'Where the person clocked out. Discarded by Kibi unless the tenant enabled location capture and the person consented.',
				routing: { request: { body: { latitude: '={{ $value }}' } } },
			},
			{
				displayName: 'Longitude',
				name: 'longitude',
				type: 'number',
				default: 0,
				description:
					'Where the person clocked out. Discarded by Kibi unless the tenant enabled location capture and the person consented.',
				routing: { request: { body: { longitude: '={{ $value }}' } } },
			},
		],
	},

	// Time entries

	{
		displayName: 'Date',
		name: 'date',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'The day the entry belongs to',
		displayOptions: { show: { ...show, operation: ['createEntry'] } },
		routing: { request: { body: { date: '={{ new Date($value).toISOString().slice(0, 10) }}' } } },
	},

	{
		displayName: 'Clock In',
		name: 'clockIn',
		type: 'string',
		required: true,
		default: '',
		placeholder: '08:30',
		description: 'When the entry starts, as HH:MM',
		displayOptions: { show: { ...show, operation: ['createEntry'] } },
		routing: { request: { body: { clock_in: '={{ $value }}' } } },
	},

	{
		displayName: 'Additional Fields',
		name: 'entryFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...show, operation: ['createEntry'] } },
		options: [
			{
				displayName: 'Absence Type Name or ID',
				name: 'absenceTypeId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAbsenceTypes' },
				default: '',
				description:
					'For an entry of type Absence: the kind of absence. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				routing: { request: { body: { absence_type_id: '={{ $value }}' } } },
			},
			{
				displayName: 'Clock Out',
				name: 'clockOut',
				type: 'string',
				default: '',
				placeholder: '17:00',
				description: 'When the entry ends, as HH:MM. Leave empty for an entry that is still running.',
				routing: { request: { body: { clock_out: '={{ $value }}' } } },
			},
			{
				displayName: 'Note',
				name: 'note',
				type: 'string',
				default: '',
				description: 'A remark on the entry',
				routing: { request: { body: { note: '={{ $value }}' } } },
			},
			{
				displayName: 'Project ID',
				name: 'projectId',
				type: 'number',
				default: 0,
				description: 'The numeric ID of the project to book the time on',
				routing: { request: { body: { project_id: '={{ $value }}' } } },
			},
			{
				displayName: 'Task ID',
				name: 'taskId',
				type: 'number',
				default: 0,
				description: 'The numeric ID of the task to book the time on',
				routing: { request: { body: { task_id: '={{ $value }}' } } },
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: 'work',
				description: 'What the entry records',
				options: ENTRY_TYPE_OPTIONS,
				routing: { request: { body: { type: '={{ $value }}' } } },
			},
		],
	},

	{
		displayName: 'Update Fields',
		name: 'entryUpdateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...show, operation: ['updateEntry'] } },
		options: [
			{
				displayName: 'Absence Type Name or ID',
				name: 'absenceTypeId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAbsenceTypes' },
				default: '',
				description:
					'For an entry of type Absence: the kind of absence. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				routing: { request: { body: { absence_type_id: '={{ $value }}' } } },
			},
			{
				displayName: 'Clock In',
				name: 'clockIn',
				type: 'string',
				default: '',
				placeholder: '08:30',
				description: 'When the entry starts, as HH:MM',
				routing: { request: { body: { clock_in: '={{ $value }}' } } },
			},
			{
				displayName: 'Clock Out',
				name: 'clockOut',
				type: 'string',
				default: '',
				placeholder: '17:00',
				description: 'When the entry ends, as HH:MM',
				routing: { request: { body: { clock_out: '={{ $value }}' } } },
			},
			{
				displayName: 'Note',
				name: 'note',
				type: 'string',
				default: '',
				description: 'A remark on the entry',
				routing: { request: { body: { note: '={{ $value }}' } } },
			},
			{
				displayName: 'Project ID',
				name: 'projectId',
				type: 'number',
				default: 0,
				description: 'The numeric ID of the project to book the time on',
				routing: { request: { body: { project_id: '={{ $value }}' } } },
			},
			{
				displayName: 'Task ID',
				name: 'taskId',
				type: 'number',
				default: 0,
				description: 'The numeric ID of the task to book the time on',
				routing: { request: { body: { task_id: '={{ $value }}' } } },
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				default: 'work',
				description: 'What the entry records',
				options: ENTRY_TYPE_OPTIONS,
				routing: { request: { body: { type: '={{ $value }}' } } },
			},
		],
	},

	{
		displayName: 'From',
		name: 'from',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'The first day of the range',
		displayOptions: { show: { ...show, operation: ['getEntries'] } },
		routing: { request: { qs: { from: DAY } } },
	},

	{
		displayName: 'To',
		name: 'to',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'The last day of the range',
		displayOptions: { show: { ...show, operation: ['getEntries'] } },
		routing: { request: { qs: { to: DAY } } },
	},

	{
		displayName: 'Year',
		name: 'year',
		type: 'number',
		default: 0,
		description: 'The year to read. Leave at 0 for the current year.',
		displayOptions: { show: { ...show, operation: ['getMonthlyBalances', 'getAbsences'] } },
		routing: { request: { qs: { year: '={{ $value || undefined }}' } } },
	},

	// Absences

	absenceTypeField(['createAbsence'], true),

	{
		displayName: 'From',
		name: 'dateFrom',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'The first day of the absence',
		displayOptions: { show: { ...show, operation: ['createAbsence'] } },
		routing: {
			request: { body: { date_from: '={{ new Date($value).toISOString().slice(0, 10) }}' } },
		},
	},

	{
		displayName: 'To',
		name: 'dateTo',
		type: 'dateTime',
		required: true,
		default: '',
		description: 'The last day of the absence',
		displayOptions: { show: { ...show, operation: ['createAbsence'] } },
		routing: {
			request: { body: { date_to: '={{ new Date($value).toISOString().slice(0, 10) }}' } },
		},
	},

	{
		displayName: 'Additional Fields',
		name: 'absenceFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...show, operation: ['createAbsence'] } },
		options: [
			{
				displayName: 'Half Day at End',
				name: 'halfDayEnd',
				type: 'boolean',
				default: false,
				description: 'Whether the last day counts as half a day',
				routing: { request: { body: { half_day_end: '={{ $value }}' } } },
			},
			{
				displayName: 'Half Day at Start',
				name: 'halfDayStart',
				type: 'boolean',
				default: false,
				description: 'Whether the first day counts as half a day',
				routing: { request: { body: { half_day_start: '={{ $value }}' } } },
			},
			{
				displayName: 'Note',
				name: 'note',
				type: 'string',
				default: '',
				description: 'A remark for whoever reviews the request',
				routing: { request: { body: { note: '={{ $value }}' } } },
			},
		],
	},

	{
		displayName: 'Update Fields',
		name: 'absenceUpdateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: { show: { ...show, operation: ['updateAbsence'] } },
		options: [
			{
				displayName: 'Absence Type Name or ID',
				name: 'absenceTypeId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAbsenceTypes' },
				default: '',
				description:
					'The kind of absence. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
				routing: { request: { body: { absence_type_id: '={{ $value }}' } } },
			},
			{
				displayName: 'From',
				name: 'dateFrom',
				type: 'dateTime',
				default: '',
				description: 'The first day of the absence',
				routing: { request: { body: { date_from: DAY } } },
			},
			{
				displayName: 'Half Day at End',
				name: 'halfDayEnd',
				type: 'boolean',
				default: false,
				description: 'Whether the last day counts as half a day',
				routing: { request: { body: { half_day_end: '={{ $value }}' } } },
			},
			{
				displayName: 'Half Day at Start',
				name: 'halfDayStart',
				type: 'boolean',
				default: false,
				description: 'Whether the first day counts as half a day',
				routing: { request: { body: { half_day_start: '={{ $value }}' } } },
			},
			{
				displayName: 'Note',
				name: 'note',
				type: 'string',
				default: '',
				description: 'A remark for whoever reviews the request',
				routing: { request: { body: { note: '={{ $value }}' } } },
			},
			{
				displayName: 'To',
				name: 'dateTo',
				type: 'dateTime',
				default: '',
				description: 'The last day of the absence',
				routing: { request: { body: { date_to: DAY } } },
			},
		],
	},

	{
		displayName: 'Filter by Status',
		name: 'filterStatus',
		type: 'options',
		default: '',
		description: 'Return only absence requests in this state',
		options: [
			{ name: 'Any', value: '' },
			{ name: 'Approved', value: 'approved' },
			{ name: 'Cancelled', value: 'cancelled' },
			{ name: 'Pending', value: 'pending' },
			{ name: 'Rejected', value: 'rejected' },
		],
		displayOptions: { show: { ...show, operation: ['getAbsences'] } },
		routing: { request: { qs: { status: '={{ $value || undefined }}' } } },
	},
];
