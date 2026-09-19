import { describe, expect, it } from 'vitest';

import { toEventOption } from './getWebhookEvents';

describe('toEventOption', () => {
	it('turns a plain event name into a readable option', () => {
		expect(toEventOption('calendar_event.cancelled')).toEqual({
			name: 'Calendar Event Cancelled',
			value: 'calendar_event.cancelled',
		});
	});

	it('prefers a label the API supplies', () => {
		expect(
			toEventOption({ value: 'task.completed', label: 'Task completed', description: 'Done' }),
		).toEqual({ name: 'Task completed', value: 'task.completed', description: 'Done' });
	});

	it('accepts an object that only carries the name', () => {
		expect(toEventOption({ name: 'post.created' })).toEqual({
			name: 'Post Created',
			value: 'post.created',
		});
	});

	it('drops entries it cannot make sense of', () => {
		expect(toEventOption('')).toBeNull();
		expect(toEventOption(42)).toBeNull();
		expect(toEventOption({ description: 'no name' })).toBeNull();
	});
});
