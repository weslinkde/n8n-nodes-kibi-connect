import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { mergeAssignees } from '../shared/assignees';
import { taskDescription } from './task';

const operations = (taskDescription.find((p) => p.name === 'operation')?.options ??
	[]) as INodePropertyOptions[];

function field(name: string): INodeProperties {
	const property = taskDescription.find((p) => p.name === name);
	expect(property, `the task resource has no field ${name}`).toBeDefined();
	return property as INodeProperties;
}

function operation(value: string): INodePropertyOptions {
	const option = operations.find((op) => op.value === value);
	expect(option, `the task resource has no operation ${value}`).toBeDefined();
	return option as INodePropertyOptions;
}

describe('assigning a task to more than one person', () => {
	// The API takes `assignees`; the node's first version only ever offered
	// one picker, which sent `assignee_id`. Both fields have to stay.
	it('keeps the single picker routing to assignee_id', () => {
		const assignee = field('assigneeId');

		expect(assignee.type).toBe('resourceLocator');
		expect(assignee.routing?.request?.body).toEqual({
			assignee_id: '={{ $value || undefined }}',
		});
		expect(assignee.displayOptions?.show?.operation).toEqual(['create', 'update']);
	});

	it('offers a second field for the rest of the people', () => {
		const assignees = field('assigneeIds');

		expect(assignees.type).toBe('string');
		expect(assignees.displayOptions?.show?.operation).toEqual(['create', 'update']);
	});

	// The merge happens in the preSend hook, because it has to read both
	// parameters. A routing block on the field would fight it.
	it('leaves the merging to the preSend hook', () => {
		expect(field('assigneeIds').routing).toBeUndefined();

		for (const value of ['create', 'update']) {
			expect(operation(value).routing?.send?.preSend, value).toEqual([mergeAssignees]);
		}
	});

	// Upsert by External ID creates a task that has no assignees yet — the
	// API ignores the field there, so the node does not offer it.
	it('does not promise assignees on the upsert', () => {
		for (const name of ['assigneeId', 'assigneeIds']) {
			expect(field(name).displayOptions?.show?.operation).not.toContain('upsertByExternalId');
		}
	});
});

describe('listing tasks', () => {
	it('offers the mine filter', () => {
		const mine = field('mine');

		expect(mine.type).toBe('boolean');
		expect(mine.default).toBe(false);
		expect(mine.displayOptions?.show?.operation).toEqual(['getAll']);
		expect(mine.routing?.request?.qs).toEqual({ mine: '={{ $value ? "true" : undefined }}' });
	});

	// The list is not scoped to the token owner by default: every task on a
	// board they can see is in it. Saying otherwise sent people looking for a
	// filter that was not there.
	it('describes the default scope as the wider one', () => {
		const notice = field('scopeNotice');

		expect(String(notice.displayName)).toContain('every task on a board');
		expect(String(notice.displayName)).toContain('Only Mine');
		expect(String(operation('getAll').description)).toContain('Only Mine');
	});
});

describe('the due date', () => {
	// Cutting the ISO string after ten characters dropped the time of day and
	// moved the date itself a day back for any moment after 22:00 in a UTC+2
	// tenant. The column behind it is a timestamp.
	it('sends the whole moment, not the date half of it', () => {
		const dueDate = field('dueDate');

		expect(dueDate.routing?.request?.body).toEqual({
			due_date: '={{ $value ? new Date($value).toISOString() : undefined }}',
		});
		expect(String(dueDate.hint)).toContain('ISO 8601');
	});
});
