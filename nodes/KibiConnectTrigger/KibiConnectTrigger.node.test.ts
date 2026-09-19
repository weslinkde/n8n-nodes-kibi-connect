import { createHmac } from 'node:crypto';

import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IHookFunctions,
	IHttpRequestOptions,
	INode,
	IWebhookFunctions,
} from 'n8n-workflow';
import { describe, expect, it, vi } from 'vitest';

import { KibiConnectTrigger } from './KibiConnectTrigger.node';

const SECRET = 'kbw_test_secret';
const SLUG = 'n8n';

const node: INode = {
	id: 'node-1',
	webhookId: 'wh-1',
	name: 'Kibi Connect Trigger',
	type: '@weslink/n8n-nodes-kibi-connect.kibiConnectTrigger',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

const credentials = {
	baseUrl: 'https://acme.kibi.de',
	apiToken: 'kbt_token',
	integrationSlug: SLUG,
};

function sign(body: string, secret = SECRET): string {
	return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

function envelope(event: string, integration: string | null = null): string {
	return JSON.stringify({
		event,
		timestamp: '2026-09-19T10:00:00+02:00',
		tenant_id: '01TENANT',
		data: { id: '01ABC', origin: { source: integration ? 'api' : 'ui', integration } },
	});
}

interface WebhookSetup {
	rawBody: string;
	headers?: Record<string, string>;
	params?: IDataObject;
	staticData?: IDataObject;
}

function webhookContext({ rawBody, headers = {}, params = {}, staticData = {} }: WebhookSetup) {
	const response = {
		statusCode: 200,
		sent: undefined as unknown,
		status(code: number) {
			this.statusCode = code;
			return this;
		},
		send(body: unknown) {
			this.sent = body;
			return this;
		},
	};

	const context = {
		getRequestObject: () => ({ rawBody: Buffer.from(rawBody) }),
		getHeaderData: () => headers,
		getBodyData: () => JSON.parse(rawBody) as IDataObject,
		getNodeParameter: (name: string, fallback: unknown) => params[name] ?? fallback,
		getWorkflowStaticData: () => staticData,
		getResponseObject: () => response,
		getCredentials: async () => credentials,
		helpers: {
			returnJsonArray: (items: IDataObject[]) => items.map((json) => ({ json })),
		},
	};

	return { context: context as unknown as IWebhookFunctions, response };
}

type HttpHandler = (options: IHttpRequestOptions) => unknown;

interface HookSetup {
	params?: IDataObject;
	staticData?: IDataObject;
	http?: HttpHandler;
}

function hookContext({ params = {}, staticData = {}, http = () => ({}) }: HookSetup) {
	const request = vi.fn((_credentialType: string, options: IHttpRequestOptions) =>
		Promise.resolve(http(options)),
	);

	const context = {
		getNodeParameter: (name: string, fallback: unknown) => params[name] ?? fallback,
		getWorkflowStaticData: () => staticData,
		getNode: () => node,
		getNodeWebhookUrl: () => 'https://n8n.example.com/webhook/wh-1/webhook',
		getWorkflow: () => ({ id: 'wf-1', name: 'Sync tasks', active: true }),
		getCredentials: async () => credentials,
		logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
		helpers: { httpRequestWithAuthentication: request },
	};

	return { context: context as unknown as IHookFunctions, request, staticData };
}

// What n8n-core's request helpers throw: the axios failure wrapped in a
// NodeApiError. The class name is what makes NodeApiError read the status and
// body off `response`, so the fake has to carry it.
function apiFailure(status: number, data: IDataObject): NodeApiError {
	class AxiosError extends Error {
		response = { status, data };
	}

	return new NodeApiError(node, new AxiosError(`Request failed with status code ${status}`));
}

const trigger = new KibiConnectTrigger();
const hooks = trigger.webhookMethods.default;

describe('KibiConnectTrigger.webhook', () => {
	const body = envelope('post.created');

	it('answers 401 and does not start the workflow when the signature is wrong', async () => {
		const { context, response } = webhookContext({
			rawBody: body,
			headers: { 'x-kibi-signature': sign(body, 'kbw_other') },
			staticData: { webhookSecret: SECRET },
		});

		const result = await trigger.webhook.call(context);

		expect(result).toEqual({ noWebhookResponse: true });
		expect(response.statusCode).toBe(401);
		expect(response.sent).toBe('Invalid signature');
	});

	it('answers 401 when the signature is missing', async () => {
		const { context, response } = webhookContext({
			rawBody: body,
			staticData: { webhookSecret: SECRET },
		});

		expect(await trigger.webhook.call(context)).toEqual({ noWebhookResponse: true });
		expect(response.statusCode).toBe(401);
	});

	// Without a stored secret nothing can be verified, so nothing may pass — a
	// lost secret must not quietly turn the trigger into an open door.
	it('answers 401 when no secret is stored', async () => {
		const { context, response } = webhookContext({
			rawBody: body,
			headers: { 'x-kibi-signature': sign(body) },
		});

		expect(await trigger.webhook.call(context)).toEqual({ noWebhookResponse: true });
		expect(response.statusCode).toBe(401);
	});

	it('emits the envelope plus the delivery headers for a selected event', async () => {
		const { context, response } = webhookContext({
			rawBody: body,
			headers: {
				'x-kibi-signature': sign(body),
				'x-kibi-delivery-id': '01DELIVERY',
				'x-kibi-timestamp': '2026-09-19T10:00:00+02:00',
			},
			params: { events: ['post.created'] },
			staticData: { webhookSecret: SECRET },
		});

		const result = await trigger.webhook.call(context);

		expect(response.statusCode).toBe(200);
		expect(result.workflowData).toHaveLength(1);
		expect(result.workflowData?.[0][0].json).toMatchObject({
			event: 'post.created',
			tenant_id: '01TENANT',
			data: { id: '01ABC' },
			deliveryId: '01DELIVERY',
			deliveredAt: '2026-09-19T10:00:00+02:00',
		});
	});

	it('acknowledges but drops an event the node did not select', async () => {
		const { context } = webhookContext({
			rawBody: body,
			headers: { 'x-kibi-signature': sign(body) },
			params: { events: ['task.completed'] },
			staticData: { webhookSecret: SECRET },
		});

		expect(await trigger.webhook.call(context)).toEqual({ webhookResponse: 'OK' });
	});

	it('acknowledges but drops the echo of its own write', async () => {
		const echo = envelope('task.updated', SLUG);
		const { context } = webhookContext({
			rawBody: echo,
			headers: { 'x-kibi-signature': sign(echo) },
			staticData: { webhookSecret: SECRET },
		});

		expect(await trigger.webhook.call(context)).toEqual({ webhookResponse: 'OK' });
	});

	it('passes its own write through when the loop breaker is off', async () => {
		const echo = envelope('task.updated', SLUG);
		const { context } = webhookContext({
			rawBody: echo,
			headers: { 'x-kibi-signature': sign(echo) },
			params: { ignoreOwnWrites: false },
			staticData: { webhookSecret: SECRET },
		});

		const result = await trigger.webhook.call(context);

		expect(result.workflowData).toHaveLength(1);
	});

	it('verifies against the pasted secret in manual mode', async () => {
		const { context } = webhookContext({
			rawBody: body,
			headers: { 'x-kibi-signature': sign(body, 'kbw_manual') },
			params: { autoRegister: false, manualSecret: 'kbw_manual' },
			// A stale automatic secret must not be consulted in manual mode.
			staticData: { webhookSecret: SECRET },
		});

		const result = await trigger.webhook.call(context);

		expect(result.workflowData).toHaveLength(1);
	});
});

describe('KibiConnectTrigger.webhookMethods', () => {
	describe('when automatic registration is off', () => {
		it('does nothing and reports success', async () => {
			const { context, request } = hookContext({ params: { autoRegister: false } });

			expect(await hooks.checkExists.call(context)).toBe(true);
			expect(await hooks.create.call(context)).toBe(true);
			expect(await hooks.delete.call(context)).toBe(true);
			expect(request).not.toHaveBeenCalled();
		});
	});

	describe('checkExists', () => {
		it('looks the endpoint up by external id, not by URL', async () => {
			const { context, request, staticData } = hookContext({
				staticData: { webhookSecret: SECRET },
				http: () => ({ data: [{ id: '01ENDPOINT' }] }),
			});

			expect(await hooks.checkExists.call(context)).toBe(true);

			const options = request.mock.calls[0][1];
			expect(options.method).toBe('GET');
			expect(options.url).toBe('https://acme.kibi.de/api/v1/webhook-endpoints');
			expect(options.qs).toEqual({ external_id: 'n8n-webhook-wh-1' });
			expect(staticData.webhookId).toBe('01ENDPOINT');
		});

		it('reports the endpoint missing and forgets it when Kibi has none', async () => {
			const { context, staticData } = hookContext({
				staticData: { webhookId: 'old', webhookSecret: SECRET },
				http: () => ({ data: [] }),
			});

			expect(await hooks.checkExists.call(context)).toBe(false);
			expect(staticData).toEqual({});
		});

		// The secret exists once, in the create response. An endpoint we can no
		// longer verify deliveries for is as good as missing.
		it('reports the endpoint missing when the secret is lost', async () => {
			const { context, staticData } = hookContext({
				http: () => ({ data: [{ id: '01ENDPOINT' }] }),
			});

			expect(await hooks.checkExists.call(context)).toBe(false);
			expect(staticData.webhookId).toBe('01ENDPOINT');
		});
	});

	describe('create', () => {
		it('registers the endpoint under the node webhook id and keeps the one-time secret', async () => {
			const { context, request, staticData } = hookContext({
				params: { events: ['post.created', 'task.completed'] },
				http: () => ({ data: { id: '01NEW' }, secret: 'kbw_fresh' }),
			});

			expect(await hooks.create.call(context)).toBe(true);

			expect(request).toHaveBeenCalledTimes(1);
			const options = request.mock.calls[0][1];
			expect(options.method).toBe('POST');
			expect(options.url).toBe('https://acme.kibi.de/api/v1/webhook-endpoints');
			expect(options.body).toEqual({
				name: 'n8n — Sync tasks',
				url: 'https://n8n.example.com/webhook/wh-1/webhook',
				events: ['post.created', 'task.completed'],
				external_id: 'n8n-webhook-wh-1',
			});
			expect(staticData).toEqual({ webhookId: '01NEW', webhookSecret: 'kbw_fresh' });
		});

		it('removes a stale endpoint on the same external id before creating', async () => {
			const { context, request, staticData } = hookContext({
				params: { events: ['post.created'] },
				staticData: { webhookId: '01STALE' },
				http: (options) =>
					options.method === 'DELETE' ? undefined : { data: { id: '01NEW' }, secret: 's' },
			});

			await hooks.create.call(context);

			expect(request.mock.calls.map(([, options]) => [options.method, options.url])).toEqual([
				['DELETE', 'https://acme.kibi.de/api/v1/webhook-endpoints/01STALE'],
				['POST', 'https://acme.kibi.de/api/v1/webhook-endpoints'],
			]);
			expect(staticData.webhookId).toBe('01NEW');
		});

		// Kibi refuses an endpoint with no events, and the node treats an empty
		// selection as "everything" — so everything is what gets subscribed.
		it('subscribes to every available event when none is selected', async () => {
			const { context, request } = hookContext({
				http: (options) =>
					options.url?.endsWith('/events')
						? { data: { events: ['post.created', 'task.created'] } }
						: { data: { id: '01NEW' }, secret: 's' },
			});

			await hooks.create.call(context);

			const post = request.mock.calls.find(([, options]) => options.method === 'POST');
			expect((post?.[1].body as IDataObject).events).toEqual(['post.created', 'task.created']);
		});

		it('explains a token without an integration slug', async () => {
			const { context } = hookContext({
				params: { events: ['post.created'] },
				http: () => {
					throw apiFailure(422, {
						message: 'This token has no integration slug.',
						code: 'integration_slug_missing',
					});
				},
			});

			const error = await hooks.create.call(context).catch((caught: unknown) => caught);

			expect(error).toBeInstanceOf(NodeOperationError);
			expect((error as Error).message).toContain('integration slug');
			expect((error as NodeOperationError).description).toContain('Register Webhook Automatically');
		});

		it('explains a policy refusal', async () => {
			const { context } = hookContext({
				params: { events: ['post.created'] },
				http: () => {
					throw apiFailure(403, {
						message: 'Managing webhook endpoints is restricted to system administrators.',
					});
				},
			});

			const error = await hooks.create.call(context).catch((caught: unknown) => caught);

			expect((error as Error).message).toContain('system administrator');
			expect((error as Error).message).toContain('webhooks:write');
		});

		it('explains a taken external id', async () => {
			const { context } = hookContext({
				params: { events: ['post.created'] },
				http: () => {
					throw apiFailure(409, { message: 'Taken.', code: 'external_id_taken' });
				},
			});

			const error = await hooks.create.call(context).catch((caught: unknown) => caught);

			expect((error as Error).message).toContain('external id');
		});
	});

	describe('delete', () => {
		it('removes the endpoint and forgets it', async () => {
			const { context, request, staticData } = hookContext({
				staticData: { webhookId: '01ENDPOINT', webhookSecret: SECRET },
			});

			expect(await hooks.delete.call(context)).toBe(true);

			const options = request.mock.calls[0][1];
			expect(options.method).toBe('DELETE');
			expect(options.url).toBe('https://acme.kibi.de/api/v1/webhook-endpoints/01ENDPOINT');
			expect(staticData).toEqual({});
		});

		it('treats an endpoint that is already gone as removed', async () => {
			const { context, staticData } = hookContext({
				staticData: { webhookId: '01ENDPOINT', webhookSecret: SECRET },
				http: () => {
					throw apiFailure(404, { message: 'Not found.' });
				},
			});

			expect(await hooks.delete.call(context)).toBe(true);
			expect(staticData).toEqual({});
		});

		it('surfaces any other failure and keeps the endpoint on record', async () => {
			const { context, staticData } = hookContext({
				staticData: { webhookId: '01ENDPOINT', webhookSecret: SECRET },
				http: () => {
					throw apiFailure(403, { message: 'Forbidden.' });
				},
			});

			await expect(hooks.delete.call(context)).rejects.toBeInstanceOf(NodeOperationError);
			expect(staticData.webhookId).toBe('01ENDPOINT');
		});

		it('has nothing to do without a recorded endpoint', async () => {
			const { context, request } = hookContext({});

			expect(await hooks.delete.call(context)).toBe(true);
			expect(request).not.toHaveBeenCalled();
		});
	});
});
