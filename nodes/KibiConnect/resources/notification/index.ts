import type { INodeProperties } from 'n8n-workflow';

import { returnAll, unwrapData } from '../../shared/descriptions';

const showOnlyForNotifications = {
	resource: ['notification'],
};

export const notificationDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForNotifications },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many notifications',
				description: "Read the token owner's own notifications",
				routing: {
					request: { method: 'GET', url: '/notifications' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Mark All as Read',
				value: 'markAllRead',
				action: 'Mark all notifications as read',
				description: "Clear the token owner's whole notification list",
				routing: {
					request: { method: 'PUT', url: '/notifications/read-all' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Mark as Read',
				value: 'markRead',
				action: 'Mark a notification as read',
				description: 'Mark one notification as read',
				routing: {
					request: {
						method: 'PUT',
						url: '=/notifications/{{$parameter.notificationId}}/read',
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Send',
				value: 'send',
				action: 'Send a notification',
				description: 'Notify people, respecting their delivery settings',
				routing: {
					request: { method: 'POST', url: '/notifications' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'send',
	},

	{
		displayName:
			'Kibi decides when and how this reaches people: do-not-disturb, quiet hours and each person\'s own push settings all apply. A notification sent at 23:00 to somebody with quiet hours is not lost, but it does not arrive at 23:00 either. Use Chat instead if you need something to land immediately.',
		name: 'deliveryNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...showOnlyForNotifications, operation: ['send'] } },
	},

	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Nightly import finished',
		description: 'The headline. Shown in the notification list and on the push message.',
		displayOptions: { show: { ...showOnlyForNotifications, operation: ['send'] } },
		routing: { request: { body: { title: '={{ $value }}' } } },
	},

	{
		displayName: 'Message',
		name: 'body',
		type: 'string',
		typeOptions: { rows: 3 },
		required: true,
		default: '',
		placeholder: '412 records imported, 3 skipped.',
		description: 'The notification text',
		displayOptions: { show: { ...showOnlyForNotifications, operation: ['send'] } },
		routing: { request: { body: { body: '={{ $value }}' } } },
	},

	{
		displayName: 'Recipients',
		name: 'recipientIds',
		type: 'string',
		required: true,
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC,01J8ZQ2M4XB7Y9C1D3E5F7G9HJ',
		description:
			'Who to notify, as a comma-separated list of user IDs. Take them from a Get Many on the User resource rather than typing them.',
		hint: 'One ID per recipient, separated by commas — an expression returning an array works too.',
		displayOptions: { show: { ...showOnlyForNotifications, operation: ['send'] } },
		routing: {
			request: {
				body: {
					recipient_ids:
						'={{ Array.isArray($value) ? $value : String($value).split(",").map(s => s.trim()).filter(Boolean) }}',
				},
			},
		},
	},

	{
		displayName: 'Link',
		name: 'url',
		type: 'string',
		default: '',
		placeholder: 'https://acme.kibi.de/wiki/01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description: 'Where clicking the notification takes the reader. Optional.',
		displayOptions: { show: { ...showOnlyForNotifications, operation: ['send'] } },
		routing: { request: { body: { url: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Notification ID',
		name: 'notificationId',
		type: 'string',
		required: true,
		default: '',
		description: 'The notification to mark as read, as returned by Get Many',
		displayOptions: { show: { ...showOnlyForNotifications, operation: ['markRead'] } },
	},

	...returnAll('notification', 'getAll'),
];
