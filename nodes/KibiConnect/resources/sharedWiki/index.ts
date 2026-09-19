import type { INodeProperties } from 'n8n-workflow';

import { downloadBinary } from '../../shared/binary';
import { unwrapData } from '../../shared/descriptions';
import { ulidField } from '../../shared/fields';

const R = 'sharedWiki';
const show = { resource: [R] };

export const sharedWikiDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show },
		options: [
			{
				name: 'Get Media',
				value: 'getMedia',
				action: 'Get an image from a shared wiki subtree',
				description:
					'Stream an image attached to a published page inside the shared subtree, as binary data',
				routing: {
					request: {
						method: 'GET',
						url: '=/shared-wiki/{{$parameter.sharedResourceId}}/media/{{$parameter.mediaId}}',
						encoding: 'arraybuffer',
						json: false,
						returnFullResponse: true,
					},
					output: { postReceive: [downloadBinary] },
				},
			},
			{
				name: 'Get Subtree',
				value: 'getSubtree',
				action: 'Get a shared wiki subtree',
				description:
					'Read the root page of a shared wiki together with all its published descendants',
				routing: {
					request: { method: 'GET', url: '=/shared-wiki/{{$parameter.sharedResourceId}}' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'getSubtree',
	},

	{
		displayName:
			'A shared wiki is a subtree somebody published for the outside world — a public manual, say. Get Subtree returns the whole tree in one answer, which is what a static-site generator mirroring it wants.',
		name: 'sharedWikiNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { ...show, operation: ['getSubtree'] } },
	},

	ulidField(
		'Shared Resource ID',
		'sharedResourceId',
		R,
		['getSubtree', 'getMedia'],
		'The ID of the share, as shown in the share link of the wiki page.',
	),

	ulidField(
		'Media ID',
		'mediaId',
		R,
		['getMedia'],
		'The image to fetch, as referenced from the content of a page in the subtree.',
	),

	{
		displayName: 'Language',
		name: 'lang',
		type: 'string',
		default: 'de',
		placeholder: 'de',
		description: 'The language to return the pages in, as a two-letter code',
		displayOptions: { show: { ...show, operation: ['getSubtree'] } },
		routing: { request: { qs: { lang: '={{ $value || undefined }}' } } },
	},
];
