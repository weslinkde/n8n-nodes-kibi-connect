import type { INodeProperties } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { notificationDescription } from './notification';

const notice = notificationDescription.find(
	(property: INodeProperties) => property.name === 'deliveryNotice',
);

describe('the delivery notice', () => {
	const text = String(notice?.displayName ?? '');

	it('is shown when a notification is sent', () => {
		expect(notice?.type).toBe('notice');
		expect(notice?.displayOptions?.show?.operation).toEqual(['send']);
	});

	// What the notice is for: Kibi's delivery rules are the surprising part
	// of this operation.
	it('still explains the delivery rules', () => {
		expect(text).toContain('quiet hours');
		expect(text).toContain('push settings');
	});

	// It used to send people to Chat for anything urgent. Whether that is
	// good advice depends on the tenant's version, so the notice describes
	// what each way does and lets the author choose.
	it('describes the chat alternative without ranking it', () => {
		expect(text).toContain('Chat');
		expect(text).not.toMatch(/Use Chat instead/i);
		expect(text).not.toMatch(/\bimmediately\b/i);
		expect(text).not.toMatch(/no (push|notification)/i);
		expect(text).not.toMatch(/silent|does not notify/i);
	});
});
