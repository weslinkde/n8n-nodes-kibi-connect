import { NodeApiError } from 'n8n-workflow';
import type {
	DeclarativeRestApiSettings,
	IExecutePaginationFunctions,
	IHttpRequestOptions,
} from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { kibiRoutingRequest } from './routing';

const node = {
	id: 'n1',
	name: 'Kibi Connect',
	type: 'kibiConnect',
	typeVersion: 1,
	position: [0, 0] as [number, number],
	parameters: {},
};

type Page = { data: unknown; meta?: Record<string, unknown> };

function fakeContext(params: Record<string, unknown>, pages: Page[] | Error) {
	const requests: IHttpRequestOptions[] = [];
	let call = 0;
	const httpRequestWithAuthentication = vi.fn(
		async (_type: string, options: IHttpRequestOptions) => {
			requests.push(options);
			if (pages instanceof Error) throw pages;
			return { body: pages[call++] };
		},
	);
	const makeRoutingRequest = vi.fn(async () => {
		if (pages instanceof Error) throw pages;
		return [{ json: { routed: true } }];
	});
	const context = {
		getNode: () => node,
		getNodeParameter: (name: string, fallback: unknown) =>
			name in params ? params[name] : fallback,
		helpers: { httpRequestWithAuthentication },
		makeRoutingRequest,
	} as unknown as IExecutePaginationFunctions;

	return { context, requests, makeRoutingRequest };
}

const requestData = {
	options: { method: 'GET', url: '/posts', qs: { search: 'canteen', limit: 50 }, headers: {} },
	preSend: [],
	postReceive: [],
} as unknown as DeclarativeRestApiSettings.ResultOptions;

function apiError(status: number, data: Record<string, unknown>): NodeApiError {
	const axiosError = Object.assign(new Error(`Request failed with status code ${status}`), {
		isAxiosError: true,
		response: { status, data },
	});
	return new NodeApiError(node, axiosError as never);
}

describe('kibiRoutingRequest', () => {
	it('hands a single request to the routing engine when Return All is off', async () => {
		const { context, makeRoutingRequest, requests } = fakeContext({ resource: 'post' }, []);

		const result = await kibiRoutingRequest.call(context, requestData);

		expect(result).toEqual([{ json: { routed: true } }]);
		expect(makeRoutingRequest).toHaveBeenCalledWith(requestData);
		expect(requests).toHaveLength(0);
	});

	it('walks the page envelope and keeps the filters on every page', async () => {
		const { context, requests } = fakeContext({ resource: 'post', returnAll: true }, [
			{ data: [{ id: 1 }, { id: 2 }], meta: { current_page: 1, last_page: 3 } },
			{ data: [{ id: 3 }], meta: { current_page: 2, last_page: 3 } },
			{ data: [{ id: 4 }], meta: { current_page: 3, last_page: 3 } },
		]);

		const result = await kibiRoutingRequest.call(context, requestData);

		expect(result.map((item) => item.json.id)).toEqual([1, 2, 3, 4]);
		expect(requests.map((r) => r.qs)).toEqual([
			{ search: 'canteen', limit: 50 },
			{ search: 'canteen', limit: 50, page: 2 },
			{ search: 'canteen', limit: 50, page: 3 },
		]);
		expect(requests.every((r) => r.returnFullResponse === true)).toBe(true);
	});

	it('walks the cursor envelope until the cursor runs out', async () => {
		const { context, requests } = fakeContext({ resource: 'shareLink', returnAll: true }, [
			{ data: [{ id: 'a' }], meta: { next_cursor: 'eyJpZCI6MX0', prev_cursor: null } },
			{ data: [{ id: 'b' }], meta: { next_cursor: null, prev_cursor: 'eyJpZCI6Mn0' } },
		]);

		const result = await kibiRoutingRequest.call(context, requestData);

		expect(result.map((item) => item.json.id)).toEqual(['a', 'b']);
		expect(requests[1].qs).toEqual({ search: 'canteen', limit: 50, cursor: 'eyJpZCI6MX0' });
	});

	// The surveys and the time entries answer a bare { data } — Return All
	// must not loop on them, nor fail on the missing meta block.
	it('stops after one request when the list is not paginated', async () => {
		const { context, requests } = fakeContext({ resource: 'survey', returnAll: true }, [
			{ data: [{ id: 1 }] },
		]);

		const result = await kibiRoutingRequest.call(context, requestData);

		expect(result).toHaveLength(1);
		expect(requests).toHaveLength(1);
	});

	it('explains a failure in terms of the resource that was asked for', async () => {
		const { context } = fakeContext({ resource: 'document' }, apiError(404, {}));

		await expect(kibiRoutingRequest.call(context, requestData)).rejects.toThrow(
			'Document Management module',
		);
	});

	it('explains a failure while paging too', async () => {
		const { context } = fakeContext(
			{ resource: 'post', returnAll: true },
			apiError(403, { error: 'Insufficient scope', message: 'Missing posts:read.' }),
		);

		await expect(kibiRoutingRequest.call(context, requestData)).rejects.toThrow(
			'My Profile > Integrations',
		);
	});
});
