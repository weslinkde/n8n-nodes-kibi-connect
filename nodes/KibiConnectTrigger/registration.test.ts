import { describe, expect, it } from 'vitest';

import {
	describeRegistrationError,
	extractHttpFailure,
	externalIdFor,
	isNotFound,
} from './registration';

describe('externalIdFor', () => {
	it('prefixes the node webhook id', () => {
		expect(externalIdFor('4f1c2b3a-0000-4000-8000-000000000000')).toBe(
			'n8n-webhook-4f1c2b3a-0000-4000-8000-000000000000',
		);
	});
});

describe('describeRegistrationError', () => {
	it('points a token without an integration slug at the manual mode', () => {
		const message = describeRegistrationError(422, { code: 'integration_slug_missing' });

		expect(message).toContain('integration slug');
		expect(message).toContain('cannot be added later');
		expect(message).toContain('Register Webhook Automatically');
	});

	it('names both requirements behind a bare 403', () => {
		const message = describeRegistrationError(403, {});

		expect(message).toContain('webhooks:write');
		expect(message).toContain('system administrator');
	});

	it('names both requirements behind the policy 403 with a message', () => {
		const message = describeRegistrationError(403, {
			message: 'Managing webhook endpoints is restricted to system administrators.',
		});

		expect(message).toContain('webhooks:write');
	});

	// These 403s have nothing to do with the token's owner; sending people to
	// check their administrator status would be a wrong turn.
	it('leaves the tenant-level 403s to the shared describer', () => {
		expect(describeRegistrationError(403, { code: 'webhooks_disabled' })).toContain(
			'Webhook endpoints',
		);
		expect(describeRegistrationError(403, { error: 'API disabled' })).toContain(
			'Administration > API',
		);
		expect(describeRegistrationError(403, { error: 'IP not allowed' })).toContain('allow list');
	});

	it('explains a taken external id', () => {
		const message = describeRegistrationError(409, { code: 'external_id_taken' });

		expect(message).toContain('external id');
		expect(message).toContain('Administration > Webhook endpoints');
	});

	it('falls back to the body message, then to the status', () => {
		expect(describeRegistrationError(500, { message: 'Server Error' })).toBe('Server Error');
		expect(describeRegistrationError(503, {})).toContain('503');
	});

	it('does not misread an unrelated 422 as a missing slug', () => {
		expect(describeRegistrationError(422, { message: 'The url field is required.' })).toBe(
			'The url field is required.',
		);
	});
});

describe('extractHttpFailure', () => {
	// The shape n8n-workflow's NodeApiError produces from an axios failure:
	// `httpCode` as a string and the parsed body under `context.data`.
	it('reads a NodeApiError built from an axios failure', () => {
		const error = Object.assign(new Error('Your request is invalid'), {
			httpCode: '422',
			context: { data: { message: 'No slug.', code: 'integration_slug_missing' } },
		});

		expect(extractHttpFailure(error)).toEqual({
			status: 422,
			body: { message: 'No slug.', code: 'integration_slug_missing' },
		});
	});

	// After a further NodeOperationError wrap the status lives one `cause`
	// down; the body is copied along but must also be found when it is not.
	it('walks the cause chain', () => {
		const axiosLike = Object.assign(new Error('Request failed with status code 409'), {
			response: { status: 409, data: { message: 'Taken.', code: 'external_id_taken' } },
		});
		const apiError = Object.assign(new Error('Conflict'), { httpCode: '409', cause: axiosLike });
		const outer = Object.assign(new Error('Described'), { cause: apiError });

		expect(extractHttpFailure(outer)).toEqual({
			status: 409,
			body: { message: 'Taken.', code: 'external_id_taken' },
		});
	});

	it('reads the request-library shape older n8n versions produced', () => {
		const error = Object.assign(new Error('403 - {"message":"Forbidden"}'), {
			statusCode: 403,
			error: { message: 'Forbidden' },
		});

		expect(extractHttpFailure(error)).toEqual({ status: 403, body: { message: 'Forbidden' } });
	});

	it('reports nothing for a network failure', () => {
		expect(extractHttpFailure(new Error('ECONNREFUSED'))).toEqual({ status: 0, body: {} });
		expect(extractHttpFailure(undefined)).toEqual({ status: 0, body: {} });
	});

	it('ignores an httpCode that is not a status', () => {
		expect(extractHttpFailure({ httpCode: 'ECONNRESET' }).status).toBe(0);
	});
});

describe('isNotFound', () => {
	it('recognises a 404 however it is wrapped', () => {
		expect(isNotFound({ httpCode: '404' })).toBe(true);
		expect(isNotFound({ cause: { response: { status: 404 } } })).toBe(true);
		expect(isNotFound({ httpCode: '403' })).toBe(false);
	});
});
