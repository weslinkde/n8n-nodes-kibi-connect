import type { INodeProperties } from 'n8n-workflow';

import { mergeAssignees } from '../../shared/assignees';
import { returnAll, unwrapData } from '../../shared/descriptions';
import {
	DATE_TIME_HINT,
	changeScanFields,
	conditionalWriteField,
	contentFormatField,
	externalIdField,
	readFormatField,
	ulidField,
} from '../../shared/fields';

const R = 'task';
const show = { resource: [R] };

const writeOps = ['create', 'update', 'upsertByExternalId'];

const STATUS_OPTIONS = [
	{ name: 'At Work', value: 'at_work' },
	{ name: 'Completed', value: 'completed' },
	{ name: 'Open', value: 'open' },
];

export const taskDescription: INodeProperties[] = [
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
				action: 'Create a task',
				description: 'Add a task. Calling this twice creates two tasks.',
				routing: {
					request: { method: 'POST', url: '/tasks' },
					send: { preSend: [mergeAssignees] },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a task',
				description: 'Move a task to the bin',
				routing: {
					request: { method: 'DELETE', url: '=/tasks/{{$parameter.taskId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Delete External Ref',
				value: 'deleteExternalRef',
				action: 'Unlink a task from its external ID',
				description: 'Release the external ID without touching the task itself',
				routing: {
					request: { method: 'DELETE', url: '=/tasks/{{$parameter.taskId}}/external-ref' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a task',
				description: 'Read one task',
				routing: {
					request: { method: 'GET', url: '=/tasks/{{$parameter.taskId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many tasks',
				description:
					'Read the tasks the token owner can see. Switch on Only Mine for the ones they created or are assigned to.',
				routing: {
					request: { method: 'GET', url: '/tasks' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a task',
				description: 'Change an existing task',
				routing: {
					request: { method: 'PUT', url: '=/tasks/{{$parameter.taskId}}' },
					send: { preSend: [mergeAssignees] },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Upsert by External ID',
				value: 'upsertByExternalId',
				action: 'Create or update a task by external ID',
				description: 'Create the task, or update the one already mapped to this ID',
				routing: {
					request: { method: 'PUT', url: '/tasks/by-external-id' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'upsertByExternalId',
	},

	{
		displayName:
			'Use Upsert by External ID for anything that runs repeatedly. Create has no memory: run the same workflow twice and you get two tasks, not one updated one.',
		name: 'upsertNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['create'] } },
	},

	{
		displayName:
			'Get Many returns what the token owner may see: every task on a board they have access to, plus the personal tasks they created or were assigned. Switch on Only Mine to narrow it to the tasks they created or are assigned to.',
		name: 'scopeNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
	},

	ulidField(
		'Task ID',
		'taskId',
		R,
		['get', 'update', 'delete', 'deleteExternalRef'],
		'The task to act on.',
	),
	externalIdField(R, ['upsertByExternalId']),

	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Review the Q3 figures',
		description: 'The task title',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { title: '={{ $value }}' } } },
	},

	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		description: 'The task description. Rich text — set Content Format to say how it is written.',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { description: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'open',
		description: 'Where the task sits on its board',
		options: STATUS_OPTIONS,
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { status: '={{ $value }}' } } },
	},

	{
		displayName: 'Priority',
		name: 'priority',
		type: 'options',
		default: 'medium',
		description: 'How urgent the task is',
		options: [
			{ name: 'High', value: 'high' },
			{ name: 'Low', value: 'low' },
			{ name: 'Medium', value: 'medium' },
			{ name: 'Urgent', value: 'urgent' },
		],
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { priority: '={{ $value }}' } } },
	},

	{
		displayName: 'Assignee',
		name: 'assigneeId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		description:
			'Who the task is for. Leave empty to leave it unassigned. For more than one person, add the rest under Additional Assignees — this one is kept.',
		displayOptions: { show: { ...show, operation: ['create', 'update'] } },
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
				hint: 'The user ULID from the employee directory.',
				placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
			},
		],
		routing: { request: { body: { assignee_id: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Additional Assignees',
		name: 'assigneeIds',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC,01J8ZQ2M4XB7Y9C1D3E5F7G9HJ',
		description:
			'Further people to assign, on top of the one picked above, as a comma-separated list of user IDs. A task can hold any number of assignees; the picker above only offers one of them.',
		hint: 'One ID per person — an expression returning an array works too. Take the IDs from a Get Many on the User resource rather than typing them.',
		displayOptions: { show: { ...show, operation: ['create', 'update'] } },
		// No routing of its own: the value is folded together with Assignee
		// into the API's `assignees` list by the operation's preSend hook.
	},

	{
		displayName: 'Assigning on Update replaces the whole list — the people named here are the people the task ends up with, not additions to whoever is on it already.',
		name: 'assigneeUpdateNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['update'] } },
	},

	{
		displayName: 'Due Date',
		name: 'dueDate',
		type: 'dateTime',
		default: '',
		description: 'When the task is due',
		hint: DATE_TIME_HINT,
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: {
			request: {
				// The whole moment, not the date half of it: cutting the string
				// after ten characters dropped the time and, for anything after
				// 22:00 in a UTC+2 tenant, moved the due date a day back.
				body: { due_date: '={{ $value ? new Date($value).toISOString() : undefined }}' },
			},
		},
	},

	{
		displayName: 'Group ID',
		name: 'groupId',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description:
			'The group whose board the task belongs to. A task without one is visible to its creator and assignees only.',
		displayOptions: { show: { ...show, operation: writeOps } },
		routing: { request: { body: { group_id: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Only Mine',
		name: 'mine',
		type: 'boolean',
		default: false,
		description:
			'Whether to return only the tasks the token owner created or is assigned to, instead of those plus every task on a board they can see',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { mine: '={{ $value ? "true" : undefined }}' } } },
	},

	{
		displayName: 'Filter by Status',
		name: 'filterStatus',
		type: 'options',
		default: '',
		description: 'Return only tasks in this state',
		options: [{ name: 'Any', value: '' }, ...STATUS_OPTIONS],
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { status: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Filter by External ID',
		name: 'filterExternalId',
		type: 'string',
		default: '',
		description:
			'Return only the task mapped to this external ID. The answer stays a list holding one entry or none.',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { external_id: '={{ $value || undefined }}' } } },
	},

	contentFormatField(R, writeOps),
	readFormatField(R, ['get', 'getAll']),
	conditionalWriteField(R, ['update', 'upsertByExternalId']),
	...changeScanFields(R, 'getAll'),
	...returnAll(R, 'getAll'),
];
