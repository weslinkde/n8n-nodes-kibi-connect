import type { INodeProperties } from 'n8n-workflow';

import { uploadBinary } from '../../shared/binary';

const R = 'media';
const show = { resource: [R] };

export const mediaDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show },
		options: [
			{
				name: 'Upload',
				value: 'upload',
				action: 'Upload a media file',
				description:
					'Upload an image or file to the media library and get back its public URL, ready to reference from a wiki page',
				routing: {
					request: { method: 'POST', url: '/media/upload' },
					send: { preSend: [uploadBinary] },
				},
			},
		],
		default: 'upload',
	},

	{
		displayName:
			'This is the way to get an image into a wiki page written through the API: upload it here first, then reference the returned URL from the page content. Files for the document management system go through the Document resource instead.',
		name: 'usageNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['upload'] } },
	},

	{
		displayName: 'Input Binary Field',
		name: 'binaryPropertyName',
		type: 'string',
		required: true,
		default: 'data',
		hint: 'The name of the input binary field containing the file to upload',
		description: 'Which binary property of the incoming item holds the file. Up to 10 MB.',
		displayOptions: { show: { ...show, operation: ['upload'] } },
	},

	{
		displayName: 'Wiki Page ID',
		name: 'wikiPageId',
		type: 'string',
		default: '',
		placeholder: '01J8ZP9K7QW3X2YB5M4N6R8TVC',
		description:
			'Place the file in the media folder of this wiki page. Leave empty to upload it to the general library.',
		displayOptions: { show: { ...show, operation: ['upload'] } },
		routing: { request: { body: { wiki_page_id: '={{ $value || undefined }}' } } },
	},
];
