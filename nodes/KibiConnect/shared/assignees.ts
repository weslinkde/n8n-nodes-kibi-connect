import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';

/**
 * A task in Kibi has a list of assignees; the node's first version offered a
 * single picker for it.
 *
 * The API takes both spellings — `assignee_id` for one person, `assignees`
 * for a list — and lets the list win when a request carries both. That is
 * what makes a second field possible without touching the first: workflows
 * built on the single picker keep sending `assignee_id` and keep behaving
 * exactly as before, and only a filled *Additional Assignees* switches the
 * request over to the list form.
 *
 * The two fields are merged rather than treated as alternatives. Someone who
 * fills both means both people, and the alternative reading — the list
 * silently replacing the picker — would drop a recipient without saying so.
 */
export function toAssigneeList(single: unknown, many: unknown): string[] | undefined {
	const extra = splitIds(many);

	// Nothing in the list field: leave the request alone so the single
	// picker's `assignee_id` travels untouched.
	if (extra.length === 0) {
		return undefined;
	}

	const first = extractId(single);

	return [...new Set(first === undefined ? extra : [first, ...extra])];
}

/**
 * Read one id out of whatever the single picker hands over.
 *
 * A resource locator arrives as `{ __rl: true, mode, value }` through
 * `getNodeParameter` unless the value is extracted explicitly, and as a plain
 * string once it is — both shapes are accepted here so the hook cannot break
 * on that detail.
 */
function extractId(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value.trim() === '' ? undefined : value.trim();
	}

	if (typeof value === 'object' && value !== null && 'value' in value) {
		return extractId((value as { value: unknown }).value);
	}

	return undefined;
}

/** Accept a comma- or newline-separated list as readily as a real array. */
function splitIds(value: unknown): string[] {
	const raw = Array.isArray(value) ? value : String(value ?? '').split(/[,\n]/);

	return raw
		.map((entry) => (typeof entry === 'string' ? entry.trim() : String(entry ?? '').trim()))
		.filter((entry) => entry !== '');
}

/**
 * Fold *Assignee* and *Additional Assignees* into the API's `assignees` list.
 *
 * Runs as a preSend hook because the merge has to read a second parameter,
 * which a routing expression can only do through `$parameter` — and a
 * resource locator arrives there as an object, so the expression would carry
 * the same unwrapping this function does, only unreadably and untestably.
 *
 * `assignee_id` is removed when the list takes over: the API would ignore it
 * anyway, and a request that states the assignment twice is one that can
 * later be read two ways.
 */
export async function mergeAssignees(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const assignees = toAssigneeList(
		this.getNodeParameter('assigneeId', ''),
		this.getNodeParameter('assigneeIds', ''),
	);

	if (assignees === undefined) {
		return requestOptions;
	}

	const body =
		typeof requestOptions.body === 'object' && requestOptions.body !== null
			? (requestOptions.body as Record<string, unknown>)
			: {};

	delete body.assignee_id;
	body.assignees = assignees;
	requestOptions.body = body;

	return requestOptions;
}
