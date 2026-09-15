import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';

import { getConversations } from './listSearch/getConversations';
import { getUsers } from './listSearch/getUsers';
import { chatDescription } from './resources/chat';
import { userDescription } from './resources/user';

export class KibiConnect implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Kibi Connect',
		name: 'kibiConnect',
		icon: {
			light: 'file:../../icons/kibiConnect.svg',
			dark: 'file:../../icons/kibiConnect.dark.svg',
		},
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and write chat, posts, wiki pages, tasks and calendar events in Kibi Connect',
		defaults: {
			name: 'Kibi Connect',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'kibiConnectApi',
				required: true,
			},
		],
		// The base URL is per tenant and comes from the credential: every
		// customer has their own host, so there is nothing to bake in here.
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}/api/v1',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Chat',
						value: 'chat',
						description: 'Send and read messages, react to them',
					},
					{
						name: 'User',
						value: 'user',
						description: 'Look people up in the employee directory',
					},
				],
				default: 'chat',
			},
			...chatDescription,
			...userDescription,
		],
	};

	// Searchable pickers. They exist so that nobody has to paste a 26-character
	// ULID by hand — and so that the ID a workflow ends up carrying came from
	// the API rather than from a transcription.
	methods = {
		listSearch: {
			getUsers,
			getConversations,
		},
	};
}
