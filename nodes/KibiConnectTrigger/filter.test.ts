import { describe, expect, it } from 'vitest';

import { isOwnEcho, matchesSelectedEvents } from './filter';

describe('matchesSelectedEvents', () => {
	it('accepts a selected event', () => {
		expect(matchesSelectedEvents('post.created', ['post.created', 'task.completed'])).toBe(true);
	});

	// The endpoint may be subscribed to more than the node selects — someone
	// widened it in Kibi's administration, or a second workflow shares it.
	// Without the local filter the workflow fires on events it never asked for.
	it('drops an event the node did not select', () => {
		expect(matchesSelectedEvents('user.created', ['post.created'])).toBe(false);
	});

	it('accepts everything when nothing is selected', () => {
		expect(matchesSelectedEvents('user.created', [])).toBe(true);
	});

	it('matches the full event name, not a prefix', () => {
		expect(matchesSelectedEvents('task.created', ['task.completed'])).toBe(false);
	});
});

describe('isOwnEcho', () => {
	// The loop: n8n writes to Kibi, Kibi fires the webhook, n8n sees the change
	// and writes again. The origin block is how a delivery admits it was us.
	it('recognises a change this integration caused', () => {
		expect(isOwnEcho({ origin: { source: 'api', integration: 'n8n' } }, 'n8n')).toBe(true);
	});

	it('lets through a change another integration caused', () => {
		expect(isOwnEcho({ origin: { source: 'api', integration: 'zapier' } }, 'n8n')).toBe(false);
	});

	it('lets through a change a person made', () => {
		expect(isOwnEcho({ origin: { source: 'ui', integration: null } }, 'n8n')).toBe(false);
	});

	it('lets everything through when no slug is configured', () => {
		expect(isOwnEcho({ origin: { source: 'api', integration: 'n8n' } }, '')).toBe(false);
	});

	it('lets through a delivery with no origin block', () => {
		expect(isOwnEcho({}, 'n8n')).toBe(false);
	});
});
