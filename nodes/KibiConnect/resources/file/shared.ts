import type { INodeProperties } from 'n8n-workflow';

/**
 * The embedded-mount context a folder or upload can be stamped with.
 *
 * Group files, wiki attachments and address-book folders live in mounts
 * that carry the owning model. The stamp is what drives permission walks and
 * — for groups — the upload notification to members; a target folder outside
 * the context's own subtree is refused with 422.
 */
export function contextFields(resource: string, operations: string[]): INodeProperties[] {
	const show = { resource: [resource], operation: operations };

	return [
		{
			displayName: 'Context Type',
			name: 'contextType',
			type: 'options',
			default: '',
			description:
				'The embedded mount this belongs to, if any. With a group context, members with access to the target folder are notified about new uploads.',
			options: [
				{ name: 'Company', value: 'company' },
				{ name: 'Contact', value: 'contact' },
				{ name: 'Group', value: 'group' },
				{ name: 'None', value: '' },
				{ name: 'Wiki Page', value: 'wiki' },
			],
			displayOptions: { show },
			routing: { request: { body: { context_type: '={{ $value || undefined }}' } } },
		},
		{
			displayName: 'Context ID',
			name: 'contextId',
			type: 'number',
			required: true,
			default: 0,
			description:
				'The numeric ID of the group, wiki page, contact or company. Unknown IDs answer 404.',
			displayOptions: { show, hide: { contextType: [''] } },
			routing: { request: { body: { context_id: '={{ $value }}' } } },
		},
	];
}

/** Sort and type filters shared by the folder-items and root-items listings. */
export function itemListFilters(resource: string, operations: string[]): INodeProperties[] {
	const show = { resource: [resource], operation: operations };

	return [
		{
			displayName: 'Sort By',
			name: 'sort',
			type: 'options',
			default: 'created_at',
			description: 'The field the listing is ordered by',
			options: [
				{ name: 'Created At', value: 'created_at' },
				{ name: 'Name', value: 'name' },
				{ name: 'Size', value: 'size' },
			],
			displayOptions: { show },
			routing: { request: { qs: { sort: '={{ $value }}' } } },
		},
		{
			displayName: 'Direction',
			name: 'dir',
			type: 'options',
			default: '',
			description:
				'Ascending or descending. The default is descending for Created At and ascending otherwise.',
			options: [
				{ name: 'Ascending', value: 'asc' },
				{ name: 'Default', value: '' },
				{ name: 'Descending', value: 'desc' },
			],
			displayOptions: { show },
			routing: { request: { qs: { dir: '={{ $value || undefined }}' } } },
		},
		{
			displayName: 'Filter by Category',
			name: 'category',
			type: 'options',
			default: '',
			description: 'Return only files of one type group',
			options: [
				{ name: 'Any', value: '' },
				{ name: 'Archives', value: 'archives' },
				{ name: 'Audio', value: 'audio' },
				{ name: 'Documents', value: 'documents' },
				{ name: 'PDFs', value: 'pdfs' },
				{ name: 'Photos', value: 'photos' },
				{ name: 'Videos', value: 'videos' },
			],
			displayOptions: { show },
			routing: { request: { qs: { category: '={{ $value || undefined }}' } } },
		},
	];
}
