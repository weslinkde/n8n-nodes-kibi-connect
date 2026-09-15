import { describe, expect, it } from 'vitest';

import { describeApiError } from './errors';

describe('describeApiError', () => {
	describe('404 on a module-gated resource', () => {
		// Time Tracking and the DMS answer 404 for every route when the module
		// is not installed, which is the same answer an unknown ID gets. That is
		// deliberate on Kibi's side — the set of installed modules should not be
		// readable from outside — but it sends people hunting for a typo in an
		// ID that was never wrong.
		it('names the Time Tracking module', () => {
			const message = describeApiError(404, {}, 'timeTracking');

			expect(message).toContain('Time Tracking module');
			expect(message).toContain('Administration > Modules');
		});

		it('names the Document Management module', () => {
			expect(describeApiError(404, {}, 'document')).toContain('Document Management module');
		});

		it('leaves an ordinary 404 alone', () => {
			expect(describeApiError(404, { message: 'No query results.' }, 'post')).toBe(
				'No query results.',
			);
		});
	});

	describe('403, which covers four unrelated situations', () => {
		it('distinguishes webhooks being off from the API being off', () => {
			const webhooks = describeApiError(403, { code: 'webhooks_disabled' }, 'webhookEndpoint');
			const api = describeApiError(403, { error: 'API disabled' }, 'post');

			expect(webhooks).toContain('Webhook endpoints');
			expect(api).toContain('Administration > API');
			expect(webhooks).not.toBe(api);
		});

		it('names the missing scope and says tokens cannot be edited', () => {
			const message = describeApiError(
				403,
				{
					error: 'Insufficient scope',
					message: 'This token does not have the required scope: posts:write',
				},
				'post',
			);

			expect(message).toContain('posts:write');
			expect(message).toContain('cannot be edited');
		});

		it('explains an IP that is not on the allow list', () => {
			expect(describeApiError(403, { error: 'IP not allowed' }, 'post')).toContain('allow list');
		});

		// The policy refusal carries neither `error` nor `code` — it is the one
		// 403 with nothing to branch on, so the fallback has to name the cause
		// people never guess: the scope is present, the account behind the token
		// is not an administrator.
		it('explains the bare 403 the policy produces', () => {
			const message = describeApiError(403, {}, 'webhookEndpoint');

			expect(message).toContain('system administrator');
		});
	});

	it('explains a token without an integration slug', () => {
		const message = describeApiError(422, { code: 'integration_slug_missing' }, 'post');

		expect(message).toContain('integration slug');
		expect(message).toContain('cannot be added later');
	});

	it('explains that external IDs are unique across resource types', () => {
		const message = describeApiError(409, { code: 'external_id_taken' }, 'post');

		expect(message).toContain('across resource types');
	});

	it('explains a failed conditional write without telling anyone to retry blindly', () => {
		const message = describeApiError(412, {}, 'wiki');

		expect(message).toContain('changed in Kibi');
		expect(message).toContain('discard');
	});

	it('falls back to the raw message, then to the status', () => {
		expect(describeApiError(500, { message: 'Server Error' }, 'post')).toBe('Server Error');
		expect(describeApiError(503, {}, 'post')).toContain('503');
	});
});
