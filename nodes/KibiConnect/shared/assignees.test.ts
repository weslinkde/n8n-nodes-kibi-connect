import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { mergeAssignees, toAssigneeList } from './assignees';

const ANNA = '01J8ZP9K7QW3X2YB5M4N6R8TVC';
const BEN = '01J8ZQ2M4XB7Y9C1D3E5F7G9HJ';
const CLARA = '01J8ZR4N6YC8Z2D4F6H8K1M3PQ';

describe('toAssigneeList', () => {
	// The whole point of the merge: a workflow built before the list field
	// existed must keep sending `assignee_id` and nothing else.
	it('stays out of the way when only the single picker is filled', () => {
		expect(toAssigneeList(ANNA, '')).toBeUndefined();
		expect(toAssigneeList({ __rl: true, mode: 'list', value: ANNA }, '')).toBeUndefined();
		expect(toAssigneeList('', '')).toBeUndefined();
	});

	it('keeps the single picker at the head of the list', () => {
		expect(toAssigneeList(ANNA, `${BEN},${CLARA}`)).toEqual([ANNA, BEN, CLARA]);
	});

	it('unwraps a resource locator', () => {
		expect(toAssigneeList({ __rl: true, mode: 'list', value: ANNA }, BEN)).toEqual([ANNA, BEN]);
	});

	it('works without a single assignee at all', () => {
		expect(toAssigneeList('', `${BEN},${CLARA}`)).toEqual([BEN, CLARA]);
		expect(toAssigneeList({ __rl: true, mode: 'list', value: '' }, BEN)).toEqual([BEN]);
	});

	it('accepts an array from an expression', () => {
		expect(toAssigneeList('', [BEN, CLARA])).toEqual([BEN, CLARA]);
	});

	// Copy-paste from a spreadsheet brings spaces, newlines and empty entries.
	it('survives whitespace, newlines and stray separators', () => {
		expect(toAssigneeList('', ` ${BEN} ,\n${CLARA},,`)).toEqual([BEN, CLARA]);
	});

	// Naming the same person twice is a 422 from the API's point of view of
	// nothing, but a duplicate in the list is noise nobody asked for.
	it('names each person once', () => {
		expect(toAssigneeList(ANNA, `${ANNA},${BEN}`)).toEqual([ANNA, BEN]);
	});
});

describe('mergeAssignees', () => {
	function context(assigneeId: unknown, assigneeIds: unknown): IExecuteSingleFunctions {
		return {
			getNodeParameter: (name: string) =>
				name === 'assigneeId' ? assigneeId : name === 'assigneeIds' ? assigneeIds : undefined,
		} as unknown as IExecuteSingleFunctions;
	}

	async function run(
		assigneeId: unknown,
		assigneeIds: unknown,
		body: Record<string, unknown>,
	): Promise<IHttpRequestOptions> {
		return await mergeAssignees.call(context(assigneeId, assigneeIds), {
			method: 'POST',
			url: '/tasks',
			body,
			json: true,
		});
	}

	it('leaves a single-assignee request exactly as the routing built it', async () => {
		const options = await run(ANNA, '', { title: 'Review', assignee_id: ANNA });

		expect(options.body).toEqual({ title: 'Review', assignee_id: ANNA });
	});

	// Both spellings in one request would work — the API lets `assignees`
	// win — but a request that states the assignment twice is one that can be
	// read two ways later.
	it('replaces assignee_id with the merged list', async () => {
		const options = await run(ANNA, BEN, { title: 'Review', assignee_id: ANNA });

		expect(options.body).toEqual({ title: 'Review', assignees: [ANNA, BEN] });
	});

	it('assigns a list without a single picker', async () => {
		const options = await run('', `${BEN},${CLARA}`, { title: 'Review' });

		expect(options.body).toEqual({ title: 'Review', assignees: [BEN, CLARA] });
	});

	it('copes with a request that has no body yet', async () => {
		const options = await run('', BEN, undefined as unknown as Record<string, unknown>);

		expect(options.body).toEqual({ assignees: [BEN] });
	});
});
