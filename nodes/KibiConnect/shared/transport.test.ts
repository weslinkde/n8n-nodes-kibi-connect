import { NodeApiError } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import {
	asReadableError,
	extractHttpFailure,
	resourceOfPath,
	type KibiRequestContext,
} from './transport';

const node = {
	id: 'n1',
	name: 'Kibi Connect',
	type: 'kibiConnect',
	typeVersion: 1,
	position: [0, 0] as [number, number],
	parameters: {},
};
const context = { getNode: () => node } as unknown as KibiRequestContext;

/** What httpRequestWithAuthentication throws: a NodeApiError built from an axios failure. */
function apiErrorFromAxios(status: number, data: Record<string, unknown>): NodeApiError {
	const axiosError = Object.assign(new Error(`Request failed with status code ${status}`), {
		isAxiosError: true,
		response: { status, data },
	});
	return new NodeApiError(node, axiosError as never);
}

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

	it('reads a real NodeApiError the same way', () => {
		const error = apiErrorFromAxios(403, {
			error: 'Insufficient scope',
			message: 'Missing files:read.',
		});

		expect(extractHttpFailure(error)).toEqual({
			status: 403,
			body: { error: 'Insufficient scope', message: 'Missing files:read.' },
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

	it('reads the legacy cause.error shape', () => {
		const error = Object.assign(new Error('404 - not found'), {
			statusCode: 404,
			cause: { error: { message: 'No query results.' } },
		});

		expect(extractHttpFailure(error)).toEqual({
			status: 404,
			body: { message: 'No query results.' },
		});
	});

	it('reports nothing for a network failure', () => {
		expect(extractHttpFailure(new Error('ECONNREFUSED'))).toEqual({ status: 0, body: {} });
		expect(extractHttpFailure(undefined)).toEqual({ status: 0, body: {} });
	});

	it('ignores an httpCode that is not a status', () => {
		expect(extractHttpFailure({ httpCode: 'ECONNRESET' }).status).toBe(0);
	});
});

describe('asReadableError', () => {
	// Wrapping a NodeApiError in a NodeApiError returns the original — the
	// constructor short-circuits — so the message has to be written onto it.
	it('rewrites the message of the NodeApiError the request helpers threw', () => {
		const original = apiErrorFromAxios(403, {
			error: 'Insufficient scope',
			message: 'Missing files:read.',
		});

		const readable = asReadableError.call(context, original, 'file');

		expect(readable).toBe(original);
		expect(readable.message).toContain('Missing files:read.');
		expect(readable.message).toContain('My Profile > Integrations');
		expect(readable.httpCode).toBe('403');
	});

	it('explains a module-gated 404 for the resource that was asked for', () => {
		const readable = asReadableError.call(context, apiErrorFromAxios(404, {}), 'document');

		expect(readable.message).toContain('Document Management module');
	});

	it('names the tenant-level refusals', () => {
		expect(
			asReadableError.call(context, apiErrorFromAxios(403, { error: 'API disabled' }), 'post')
				.message,
		).toContain('Administration > API');
		expect(
			asReadableError.call(context, apiErrorFromAxios(403, { error: 'IP not allowed' }), 'post')
				.message,
		).toContain('allow list');
	});

	it('wraps a legacy request-library error into a NodeApiError', () => {
		const legacy = Object.assign(new Error('404 - {"message":"No query results."}'), {
			statusCode: 404,
			cause: { error: { message: 'No query results.' } },
		});

		const readable = asReadableError.call(context, legacy, 'timeTracking');

		expect(readable).toBeInstanceOf(NodeApiError);
		expect(readable.message).toContain('Time Tracking module');
		expect(readable.httpCode).toBe('404');
	});

	// n8n maps the common network errors to a sentence of its own; what must
	// not happen is a made-up "HTTP 0".
	it('keeps a network failure in its own words', () => {
		const readable = asReadableError.call(context, new Error('ECONNREFUSED'), 'post');

		expect(readable).toBeInstanceOf(NodeApiError);
		expect(readable.message).toMatch(/refused/i);
		expect(readable.message).not.toContain('HTTP 0');
	});
});

describe('resourceOfPath', () => {
	it('maps the module-gated prefixes', () => {
		expect(resourceOfPath('/time-tracking/entries')).toBe('timeTracking');
		expect(resourceOfPath('/dms/documents')).toBe('document');
		expect(resourceOfPath('/posts')).toBe('other');
	});
});
