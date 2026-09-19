import type { INodeProperties } from 'n8n-workflow';

/** A Kibi identifier is a ULID: 26 characters from Crockford's base32. */
const ULID_PATTERN = '^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$';
const ULID_EXAMPLE = '01J8ZP9K7QW3X2YB5M4N6R8TVC';

/**
 * An identifier field for a record the node cannot offer a picker for yet.
 *
 * The validation is not decoration: a mistyped ULID reaches the API as a
 * perfectly well-formed request and comes back 404, which reads like "the
 * record is gone" rather than "you pasted something wrong". Failing in the
 * editor instead costs nothing and says the right thing.
 */
export function ulidField(
	displayName: string,
	name: string,
	resource: string,
	operations: string[],
	description: string,
): INodeProperties {
	return {
		displayName,
		name,
		type: 'string',
		required: true,
		default: '',
		description,
		hint: 'A Kibi ID is 26 characters — copy it from a previous step rather than typing it.',
		placeholder: ULID_EXAMPLE,
		displayOptions: { show: { resource: [resource], operation: operations } },
		typeOptions: {
			// Surfaced as a validation hint in the editor; the API is still the
			// authority on whether the record exists.
			regex: ULID_PATTERN,
		},
	};
}

/**
 * The external id that makes an upsert an upsert.
 *
 * The uniqueness rule is the part people get wrong, so it is stated on the
 * field rather than left to the guide: the pair (integration, external id) is
 * unique across the **whole tenant and every resource type**, so a wiki page
 * and a task cannot share one. A collision answers 409 and may well point at a
 * record this token is not even allowed to see.
 */
export function externalIdField(resource: string, operations: string[]): INodeProperties {
	return {
		displayName: 'External ID',
		name: 'externalId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'P-2026-0815',
		description:
			'Your own stable identifier for this record in the source system. Unique per integration across the whole tenant and across resource types — a wiki page and a task cannot share one.',
		hint: 'Reusing an ID that belongs to another record answers 409, even if that record is invisible to this token.',
		displayOptions: { show: { resource: [resource], operation: operations } },
		routing: { request: { body: { external_id: '={{ $value }}' } } },
	};
}

/**
 * How a rich-text field is encoded on the way in and out.
 *
 * Kibi stores rich text as a document tree. HTML, Markdown and plain text are
 * conversions at the boundary, and the conversion is lossy in one direction:
 * anything Kibi has no node for is dropped when Markdown or HTML is parsed in.
 * A round trip therefore does not have to give back what it was handed.
 */
export function contentFormatField(resource: string, operations: string[]): INodeProperties {
	return {
		displayName: 'Content Format',
		name: 'contentFormat',
		type: 'options',
		// HTML, not the document tree: a workflow author writes markup or
		// Markdown in an expression, and a plain string sent as JSON would be
		// stored as one literal text node.
		default: 'html',
		description:
			'How the rich-text field in this request is written. Kibi stores a document tree; HTML and Markdown are parsed into one on the way in, and anything it has no node for is lost at that point.',
		options: [
			{ name: 'HTML', value: 'html' },
			{ name: 'JSON (Document Tree)', value: 'json' },
			{ name: 'Markdown', value: 'markdown' },
		],
		displayOptions: { show: { resource: [resource], operation: operations } },
		routing: { request: { body: { content_format: '={{ $value }}' } } },
	};
}

/** The read-side counterpart: which shape the rich text comes back in. */
export function readFormatField(resource: string, operations: string[]): INodeProperties {
	return {
		displayName: 'Read Format',
		name: 'format',
		type: 'options',
		default: 'html',
		description:
			'Which shape rich text comes back in. Converting to Markdown or plain text discards formatting Kibi can represent but those cannot.',
		options: [
			{ name: 'HTML', value: 'html' },
			{ name: 'JSON (Document Tree)', value: 'json' },
			{ name: 'Markdown', value: 'markdown' },
			{ name: 'Plain Text', value: 'text' },
		],
		displayOptions: { show: { resource: [resource], operation: operations } },
		routing: { request: { qs: { format: '={{ $value }}' } } },
	};
}

/**
 * The pair that turns a list endpoint into a change feed.
 *
 * Without them a scheduled workflow re-reads everything every run and decides
 * for itself what is new. With them Kibi does the deciding, which is both
 * cheaper and correct across pages.
 */
export function changeScanFields(resource: string, operation: string): INodeProperties[] {
	const show = { resource: [resource], operation: [operation] };

	return [
		{
			displayName: 'Changed Since',
			name: 'updatedSince',
			type: 'dateTime',
			default: '',
			description:
				'Return only records changed after this moment. Combine with sorting by Updated At and move the watermark forward after each run.',
			displayOptions: { show },
			routing: { request: { qs: { updated_since: '={{ $value || undefined }}' } } },
		},
		{
			displayName: 'Sort By',
			name: 'sort',
			type: 'options',
			default: '',
			description:
				'The order results come back in. Sorting by Updated At is what makes paging through a change feed safe.',
			options: [
				{ name: 'Default', value: '' },
				{ name: 'Updated At (Ascending)', value: 'updated_at' },
				{ name: 'Updated At (Descending)', value: '-updated_at' },
			],
			displayOptions: { show },
			routing: { request: { qs: { sort: '={{ $value || undefined }}' } } },
		},
	];
}

/**
 * Optimistic locking, for the writes that support it.
 *
 * The value has to be an HTTP-date (RFC 7231), which is what `toUTCString()`
 * produces — an ISO 8601 string earns a 400 rather than being accepted and
 * ignored. Kibi refuses the header outright on routes that cannot honour it,
 * so a caller can never believe themselves protected when they are not.
 */
export function conditionalWriteField(resource: string, operations: string[]): INodeProperties {
	return {
		displayName: 'Only If Unchanged Since',
		name: 'ifUnmodifiedSince',
		type: 'dateTime',
		default: '',
		description:
			'Refuse the write if the record changed in Kibi after this moment. Send the Updated At you last read. Leave empty to overwrite whatever is there.',
		hint: 'Answers 412 instead of overwriting — which is what you want in a sync, because the alternative is a colleague\'s edit disappearing silently.',
		displayOptions: { show: { resource: [resource], operation: operations } },
		routing: {
			request: {
				headers: {
					'If-Unmodified-Since': '={{ $value ? new Date($value).toUTCString() : undefined }}',
				},
			},
		},
	};
}
