import type { INodeProperties } from 'n8n-workflow';

import { returnAll, unwrapData } from '../../shared/descriptions';

const showOnlyForChat = {
	resource: ['chat'],
};

/**
 * The conversation a message goes to, as a picker rather than a ULID field.
 *
 * Reused by every operation that addresses a conversation, so the three modes
 * stay identical between them: pick from the list, paste an ID, or drive it
 * from an expression in a loop.
 */
const conversationLocator: INodeProperties = {
	displayName: 'Conversation',
	name: 'conversationId',
	type: 'resourceLocator',
	required: true,
	default: { mode: 'list', value: '' },
	description: 'The conversation to act on',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'getConversations',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			hint: 'The conversation ULID, as returned by Get Conversations',
			placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$',
						errorMessage: 'A Kibi ID is 26 characters (a ULID) — this does not look like one',
					},
				},
			],
		},
	],
};

export const chatDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showOnlyForChat },
		options: [
			{
				name: 'Add Reaction',
				value: 'addReaction',
				action: 'Add a reaction to a message',
				description: 'React to a message with an emoji',
				routing: {
					request: {
						method: 'POST',
						url: '=/chat/messages/{{$parameter.messageId}}/reactions',
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Conversations',
				value: 'getConversations',
				action: 'Get many conversations',
				description: 'List the conversations the token owner takes part in',
				routing: {
					request: { method: 'GET', url: '/chat/conversations' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Messages',
				value: 'getMessages',
				action: 'Get many messages',
				description: 'Read the messages of one conversation',
				routing: {
					request: {
						method: 'GET',
						url: '=/chat/conversations/{{$parameter.conversationId}}/messages',
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Remove Reaction',
				value: 'removeReaction',
				action: 'Remove a reaction from a message',
				description: "Take back a reaction the token owner's account left",
				routing: {
					request: {
						method: 'DELETE',
						url: '=/chat/messages/{{$parameter.messageId}}/reactions/{{encodeURIComponent($parameter.emoji)}}',
					},
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Send Direct Message',
				value: 'sendDirect',
				action: 'Send a direct message',
				description: 'Message one person, opening the conversation if there is none yet',
				routing: {
					request: { method: 'POST', url: '/chat/direct' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Send Message',
				value: 'sendMessage',
				action: 'Send a message to a conversation',
				description: 'Post into an existing conversation',
				routing: {
					request: {
						method: 'POST',
						url: '=/chat/conversations/{{$parameter.conversationId}}/messages',
					},
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'sendDirect',
	},

	{
		displayName:
			'Messages are sent as the person the API token belongs to — there is no separate bot identity. Recipients see that account\'s name and picture, so a token minted from a personal account will look like that colleague wrote it. Ask an administrator for a dedicated service account if that matters.',
		name: 'senderNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: { ...showOnlyForChat, operation: ['sendMessage', 'sendDirect'] },
		},
	},

	{
		...conversationLocator,
		displayOptions: {
			show: { ...showOnlyForChat, operation: ['getMessages', 'sendMessage'] },
		},
	},

	{
		displayName: 'Recipient',
		name: 'recipientId',
		type: 'resourceLocator',
		required: true,
		default: { mode: 'list', value: '' },
		description: 'Who to message. A conversation is opened if none exists yet.',
		displayOptions: { show: { ...showOnlyForChat, operation: ['sendDirect'] } },
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
				hint: 'The user ULID from the employee directory',
				placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
			},
		],
		routing: {
			request: { body: { recipient_id: '={{ $value }}' } },
		},
	},

	{
		displayName: 'Message',
		name: 'body',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 4 },
		description: 'The message text. Up to 10,000 characters.',
		placeholder: 'The nightly import finished: 412 records, 3 skipped.',
		displayOptions: {
			show: { ...showOnlyForChat, operation: ['sendMessage', 'sendDirect'] },
		},
		routing: {
			request: { body: { body: '={{ $value }}' } },
		},
	},

	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		description: 'The numeric ID of the message to react to, as returned by Get Messages',
		hint: 'Reactions address messages by their numeric ID, not by a ULID like everything else',
		displayOptions: {
			show: { ...showOnlyForChat, operation: ['addReaction', 'removeReaction'] },
		},
	},

	{
		displayName: 'Emoji',
		name: 'emoji',
		type: 'string',
		required: true,
		default: '',
		placeholder: '👍',
		description: 'The emoji character itself, not a shortcode such as :thumbsup:',
		displayOptions: {
			show: { ...showOnlyForChat, operation: ['addReaction', 'removeReaction'] },
		},
		routing: {
			// Only the add path sends a body; the remove path carries the emoji
			// in the URL, where it has to be percent-encoded.
			send: { type: 'body', property: 'emoji' },
		},
	},

	{
		displayName:
			'End-to-end encrypted conversations are readable only by their participants. This node receives an opaque placeholder instead of the text for those, by design — a token cannot be handed the plaintext of a conversation it is not a member of.',
		name: 'e2eNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...showOnlyForChat, operation: ['getMessages'] } },
	},

	...returnAll('chat', 'getConversations'),
	...returnAll('chat', 'getMessages'),
];
