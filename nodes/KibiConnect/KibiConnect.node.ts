import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';

import { getConversations } from './listSearch/getConversations';
import { getUsers } from './listSearch/getUsers';
import { calendarEventDescription } from './resources/calendarEvent';
import { chatDescription } from './resources/chat';
import { fileDescription } from './resources/file';
import { folderDescription } from './resources/folder';
import { notificationDescription } from './resources/notification';
import { postDescription } from './resources/post';
import { shareLinkDescription } from './resources/shareLink';
import { taskDescription } from './resources/task';
import { userDescription } from './resources/user';
import { wikiDescription } from './resources/wiki';

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
		description:
			'Read and write chat, posts, wiki pages, tasks, calendar events, files and folders in Kibi Connect',
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
						name: 'Calendar Event',
						value: 'calendarEvent',
						description: 'Appointments and meetings',
					},
					{
						name: 'Chat',
						value: 'chat',
						description: 'Send and read messages, react to them',
					},
					{
						name: 'File',
						value: 'file',
						description: 'Files in the file manager — needs the files:read / files:write scopes',
					},
					{
						name: 'Folder',
						value: 'folder',
						description: 'Folders of the file manager — needs the files:read / files:write scopes',
					},
					{
						name: 'Notification',
						value: 'notification',
						description: "Notify people through Kibi's own delivery rules",
					},
					{
						name: 'Post',
						value: 'post',
						description: 'News and announcements in the feed',
					},
					{
						name: 'Share Link',
						value: 'shareLink',
						description: 'Public links to files and folders — needs the files:read / files:write scopes',
					},
					{
						name: 'Task',
						value: 'task',
						description: 'Work items on a board',
					},
					{
						name: 'User',
						value: 'user',
						description: 'Look people up in the employee directory',
					},
					{
						name: 'Wiki Page',
						value: 'wiki',
						description: 'Knowledge base pages',
					},
				],
				default: 'chat',
			},
			...calendarEventDescription,
			...chatDescription,
			...fileDescription,
			...folderDescription,
			...notificationDescription,
			...postDescription,
			...shareLinkDescription,
			...taskDescription,
			...userDescription,
			...wikiDescription,
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
