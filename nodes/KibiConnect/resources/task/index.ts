import type { INodeProperties } from 'n8n-workflow';

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
				description: 'Read the tasks the token owner created or was assigned',
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
			'Get Many returns the tasks the token owner created or is assigned to — not every task in the tenant. A service account therefore sees only what was created through it or handed to it.',
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
		description: 'Who the task is for. Leave empty to leave it unassigned.',
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
