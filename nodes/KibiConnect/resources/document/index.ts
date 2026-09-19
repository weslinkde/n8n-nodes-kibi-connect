import type { INodeProperties } from 'n8n-workflow';

import { downloadBinary, uploadBinary } from '../../shared/binary';
import { returnAll, unwrapData } from '../../shared/descriptions';
import { ulidField } from '../../shared/fields';

const R = 'document';
const show = { resource: [R] };

/**
 * The four read endpoints that only exist on API v2. They accept the same
 * Bearer token (scope files:read) and answer in the same `{ data }` envelope,
 * so the only difference a workflow author sees is the base URL — which is
 * set per operation here rather than through a second credential.
 */
const V2_BASE_URL = '={{$credentials.baseUrl}}/api/v2';

const DOC_TYPE_OPTIONS = [
	{ name: 'Anleitung (Manual)', value: 'anleitung' },
	{ name: 'Angebot (Quote)', value: 'angebot' },
	{ name: 'Brief (Letter)', value: 'brief' },
	{ name: 'Datenblatt (Data Sheet)', value: 'datenblatt' },
	{ name: 'Lieferschein (Delivery Note)', value: 'lieferschein' },
	{ name: 'Mahnung (Reminder)', value: 'mahnung' },
	{ name: 'Publikation (Publication)', value: 'publikation' },
	{ name: 'Rechnung (Invoice)', value: 'rechnung' },
	{ name: 'Sonstiges (Other)', value: 'sonstiges' },
	{ name: 'Vertrag (Contract)', value: 'vertrag' },
];

export const documentDescription: INodeProperties[] = [
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
				action: 'Upload a document',
				description:
					'Upload a file into the document management system. Text extraction and auto-filing run afterwards, so the metadata in the answer is still empty.',
				routing: {
					request: { method: 'POST', url: '/dms/documents' },
					send: { preSend: [uploadBinary] },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Download',
				value: 'download',
				action: 'Download a document',
				description: 'Fetch the file itself, as binary data',
				routing: {
					request: {
						method: 'GET',
						url: '=/dms/documents/{{$parameter.documentId}}/download',
						// Without `stream` Kibi answers a 302 to a presigned storage URL,
						// and the Authorization header would follow the redirect there.
						qs: { stream: 1 },
						encoding: 'arraybuffer',
						json: false,
						returnFullResponse: true,
					},
					output: { postReceive: [downloadBinary] },
				},
			},
			{
				name: 'Fulltext Search',
				value: 'fulltextSearch',
				action: 'Search documents by their text',
				description:
					'Search the extracted text of every document the token owner may see, with a snippet per hit',
				routing: {
					request: { method: 'GET', baseURL: V2_BASE_URL, url: '/dms/search' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get',
				value: 'get',
				action: 'Get a document',
				description:
					'Read one document with its extracted metadata, version history and notes',
				routing: {
					request: { method: 'GET', url: '=/dms/documents/{{$parameter.documentId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Doc Types',
				value: 'getDocTypes',
				action: 'Get many document types',
				description: 'Read the document types in use, with how many documents each holds',
				routing: {
					request: { method: 'GET', baseURL: V2_BASE_URL, url: '/dms/doc-types' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Inbox',
				value: 'getInbox',
				action: 'Get many inbox documents',
				description: 'Read the documents that arrived through upload links and await filing',
				routing: {
					request: { method: 'GET', baseURL: V2_BASE_URL, url: '/dms/inbox' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many documents',
				description:
					'Read the documents the token owner may see, with extracted metadata, retention info and version count',
				routing: {
					request: { method: 'GET', url: '/dms/documents' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Recent',
				value: 'getRecent',
				action: 'Get many recent documents',
				description: 'Read the documents filed most recently',
				routing: {
					request: { method: 'GET', baseURL: V2_BASE_URL, url: '/dms/recent' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Structure',
				value: 'getStructure',
				action: 'Get the document folder structure',
				description:
					'Read the folder tree below the DMS root, without the folders the token owner may not see',
				routing: {
					request: { method: 'GET', url: '/dms/structure' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'getAll',
	},

	{
		displayName:
			'Requires the Document Management module. Kibi answers 404 for every DMS route when the module is not installed — the same answer as for an unknown ID, on purpose.',
		name: 'moduleNotice',
		type: 'notice',
		default: '',
		displayOptions: { show },
	},

	ulidField('Document ID', 'documentId', R, ['get', 'download'], 'The document to act on.'),

	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field containing the file to upload',
		description: 'Which binary property of the incoming item holds the file',
		displayOptions: { show: { ...show, operation: ['create'] } },
	},

	{
		displayName: 'Folder ID',
		name: 'folderUlid',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description:
			'The DMS folder to file the document in. Take the ID from Get Structure. Leave empty for the DMS root.',
		displayOptions: { show: { ...show, operation: ['create'] } },
		routing: { request: { body: { folder_ulid: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Query',
		name: 'q',
		type: 'string',
		default: '',
		description: 'Filter documents by name and extracted text',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { q: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Query',
		name: 'searchQuery',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'Rechnung Müller März',
		description: 'What to search for in the extracted text',
		displayOptions: { show: { ...show, operation: ['fulltextSearch'] } },
		routing: { request: { qs: { q: '={{ $value }}' } } },
	},

	{
		displayName: 'Document Type',
		name: 'docType',
		type: 'options',
		default: '',
		description: 'Return only documents of this type',
		options: [{ name: 'Any', value: '' }, ...DOC_TYPE_OPTIONS],
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { doc_type: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Sender',
		name: 'sender',
		type: 'string',
		default: '',
		description: 'Return only documents from this sender, as extracted from the document',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { sender: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Tag',
		name: 'tag',
		type: 'string',
		default: '',
		description: 'Return only documents carrying this tag',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { tag: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Folder ID',
		name: 'filterFolder',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description: 'Return only documents filed in this folder. Take the ID from Get Structure.',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { folder: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Days',
		name: 'days',
		type: 'number',
		default: 0,
		description: 'Return only documents filed within the last N days. Leave at 0 for no limit.',
		displayOptions: { show: { ...show, operation: ['getAll'] } },
		routing: { request: { qs: { days: '={{ $value || undefined }}' } } },
	},

	{
		displayName: 'Limit',
		name: 'v2Limit',
		type: 'number',
		typeOptions: { minValue: 1, maxValue: 50 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { ...show, operation: ['fulltextSearch', 'getRecent', 'getInbox'] } },
		routing: { request: { qs: { limit: '={{ $value }}' } } },
	},

	...returnAll(R, 'getAll'),
];
