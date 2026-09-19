import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';

import { getConversations } from './listSearch/getConversations';
import { getUsers } from './listSearch/getUsers';
import { getAbsenceTypes } from './loadOptions/getAbsenceTypes';
import { getGroupTypes } from './loadOptions/getGroupTypes';
import { calendarEventDescription } from './resources/calendarEvent';
import { callLinkDescription } from './resources/callLink';
import { chatDescription } from './resources/chat';
import { documentDescription } from './resources/document';
import { fileDescription } from './resources/file';
import { folderDescription } from './resources/folder';
import { groupDescription } from './resources/group';
import { mediaDescription } from './resources/media';
import { notificationDescription } from './resources/notification';
import { postDescription } from './resources/post';
import { searchDescription } from './resources/search';
import { shareLinkDescription } from './resources/shareLink';
import { sharedWikiDescription } from './resources/sharedWiki';
import { surveyDescription } from './resources/survey';
import { taskDescription } from './resources/task';
import { timeTrackingDescription } from './resources/timeTracking';
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
			'Read and write chat, posts, wiki pages, tasks, calendar events, groups, files, documents and time tracking in Kibi Connect',
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
						name: 'Call Link',
						value: 'callLink',
						description: 'Meeting links that guests open without a Kibi account',
					},
					{
						name: 'Chat',
						value: 'chat',
						description: 'Send and read messages, react to them',
					},
					{
						name: 'Document',
						value: 'document',
						description:
							'Files in the document management system. Requires the Document Management module — Kibi answers 404 for every DMS route when the module is not installed.',
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
						name: 'Group',
						value: 'group',
						description: 'Teams, departments and projects, with their posts, members and files',
					},
					{
						name: 'Media',
						value: 'media',
						description: 'Upload images for wiki pages',
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
						name: 'Search',
						value: 'search',
						description: 'Search posts, wiki pages and people in one go',
					},
					{
						name: 'Share Link',
						value: 'shareLink',
						description: 'Public links to files and folders — needs the files:read / files:write scopes',
					},
					{
						name: 'Shared Wiki',
						value: 'sharedWiki',
						description: 'Wiki subtrees published for the outside world',
					},
					{
						name: 'Survey',
						value: 'survey',
						description: 'Published surveys and their answer options',
					},
					{
						name: 'Task',
						value: 'task',
						description: 'Work items on a board',
					},
					{
						name: 'Time Tracking',
						value: 'timeTracking',
						description:
							'Clock in and out, time entries, absences and balances. Requires the Time Tracking module — Kibi answers 404 for every route when the module is not installed.',
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
			...callLinkDescription,
			...chatDescription,
			...documentDescription,
			...fileDescription,
			...folderDescription,
			...groupDescription,
			...mediaDescription,
			...notificationDescription,
			...postDescription,
			...searchDescription,
			...shareLinkDescription,
			...sharedWikiDescription,
			...surveyDescription,
			...taskDescription,
			...timeTrackingDescription,
			...userDescription,
			...wikiDescription,
		],
	};

	// Searchable pickers and dropdowns. They exist so that nobody has to paste
	// a 26-character ULID or guess a tenant-specific slug by hand — and so
	// that the ID a workflow ends up carrying came from the API rather than
	// from a transcription.
	methods = {
		listSearch: {
			getUsers,
			getConversations,
		},
		loadOptions: {
			getAbsenceTypes,
			getGroupTypes,
		},
	};
}
