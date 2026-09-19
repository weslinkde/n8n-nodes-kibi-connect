import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IHookFunctions,
	IHttpRequestMethods,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';

import { extractHttpFailure, kibiApiRequest } from '../KibiConnect/shared/transport';
import { isOwnEcho, matchesSelectedEvents, type OriginBearingData } from './filter';
import { getWebhookEvents } from './loadOptions/getWebhookEvents';
import { describeRegistrationError, externalIdFor, isNotFound } from './registration';
import { verifyKibiSignature } from './verify';

/** What Kibi POSTs; see the request shape section of its webhook guide. */
interface WebhookEnvelope extends IDataObject {
	event?: string;
	timestamp?: string;
	tenant_id?: string;
	data?: IDataObject & OriginBearingData;
}

interface WebhookEndpointResource {
	id: string;
}

export class KibiConnectTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Kibi Connect Trigger',
		name: 'kibiConnectTrigger',
		icon: {
			light: 'file:../../icons/kibiConnect.svg',
			dark: 'file:../../icons/kibiConnect.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when something happens in Kibi Connect',
		defaults: {
			name: 'Kibi Connect Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'kibiConnectApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Register Webhook Automatically',
				name: 'autoRegister',
				type: 'boolean',
				default: true,
				description:
					'Whether to create the webhook endpoint in Kibi when the workflow is activated and remove it again when it is deactivated. Requires a token with the webhooks:write scope, an integration slug, and a system administrator as its owner. Switch off to register it by hand instead.',
			},
			{
				displayName: 'Webhook Secret',
				name: 'manualSecret',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				required: true,
				description:
					'The signing secret Kibi showed once when the endpoint was created. Every delivery is verified against it.',
				displayOptions: {
					show: {
						autoRegister: [false],
					},
				},
			},
			{
				displayName: 'Event Names or IDs',
				name: 'events',
				type: 'multiOptions',
				typeOptions: {
					loadOptionsMethod: 'getWebhookEvents',
				},
				default: [],
				required: true,
				description:
					'The events to react to. Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Ignore Own Writes',
				name: 'ignoreOwnWrites',
				type: 'boolean',
				default: true,
				description:
					'Whether to drop events this integration caused itself. Leave on for any workflow that also writes to Kibi — without it, writing triggers the webhook, which triggers the write again.',
			},
		],
	};

	methods = {
		loadOptions: {
			getWebhookEvents,
		},
	};

	webhookMethods = {
		default: {
			/**
			 * Is our endpoint still there?
			 *
			 * Looked up by external id and NOT by URL. n8n hands out a different
			 * webhook URL for a test run than for production, so a URL match would
			 * miss on the switch and register a second endpoint — and the customer
			 * would get every event twice.
			 */
			async checkExists(this: IHookFunctions): Promise<boolean> {
				if (!autoRegisterEnabled.call(this)) {
					return true;
				}

				const staticData = this.getWorkflowStaticData('node');

				const response = await registrationRequest.call(
					this,
					'GET',
					'/webhook-endpoints',
					undefined,
					{ external_id: externalIdFor(webhookIdOf.call(this)) },
				);
				const endpoints = (response as { data: WebhookEndpointResource[] }).data;

				if (endpoints.length === 0) {
					delete staticData.webhookId;
					delete staticData.webhookSecret;
					return false;
				}

				staticData.webhookId = endpoints[0].id;

				// The secret is not in this answer and never will be — it exists
				// once, in the create response. If we have lost it we cannot verify
				// anything, so the honest move is to report the endpoint as missing
				// and let n8n recreate it (`create` clears the stale one first).
				return typeof staticData.webhookSecret === 'string' && staticData.webhookSecret !== '';
			},

			async create(this: IHookFunctions): Promise<boolean> {
				if (!autoRegisterEnabled.call(this)) {
					return true;
				}

				const staticData = this.getWorkflowStaticData('node');
				const webhookUrl = this.getNodeWebhookUrl('default');

				if (webhookUrl === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						'n8n did not provide a webhook URL for this node, so there is nothing to register in Kibi.',
					);
				}

				// An old endpoint may still be sitting on this external id from a
				// previous activation whose secret we no longer have. Clear it
				// first, or the create below answers 409.
				if (typeof staticData.webhookId === 'string') {
					try {
						await registrationRequest.call(
							this,
							'DELETE',
							`/webhook-endpoints/${staticData.webhookId}`,
						);
					} catch (error) {
						this.logger.warn(
							`Kibi Connect Trigger: could not remove the stale webhook endpoint ${staticData.webhookId} before re-creating it: ${(error as Error).message}`,
						);
					}
				}

				const response = (await registrationRequest.call(this, 'POST', '/webhook-endpoints', {
					// Kibi caps the name at 255 characters.
					name: `n8n — ${this.getWorkflow().name ?? 'workflow'}`.slice(0, 255),
					url: webhookUrl,
					events: await eventsToSubscribe.call(this),
					external_id: externalIdFor(webhookIdOf.call(this)),
				})) as { data: WebhookEndpointResource; secret: string };

				// Contract per openapi/kibi-v1.json, POST /webhook-endpoints 201:
				// `{ data: WebhookEndpointResource, secret }` — the secret is a
				// sibling of `data`, not a field inside it, and this is the only
				// time Kibi ever hands it out.
				staticData.webhookId = response.data.id;
				staticData.webhookSecret = response.secret;

				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				if (!autoRegisterEnabled.call(this)) {
					return true;
				}

				const staticData = this.getWorkflowStaticData('node');
				if (typeof staticData.webhookId !== 'string') {
					return true;
				}

				try {
					await registrationRequest.call(
						this,
						'DELETE',
						`/webhook-endpoints/${staticData.webhookId}`,
					);
				} catch (error) {
					// A 404 means it is already gone — which is the state we wanted.
					// Anything else is worth surfacing.
					if (!isNotFound(error)) {
						throw new NodeOperationError(this.getNode(), error as Error);
					}

					this.logger.info(
						`Kibi Connect Trigger: webhook endpoint ${staticData.webhookId} was already gone.`,
					);
				}

				delete staticData.webhookId;
				delete staticData.webhookSecret;

				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const headers = this.getHeaderData();
		const secret = await resolveSecret.call(this);

		if (
			!verifyKibiSignature(
				await rawBodyOf(request),
				headerValue(headers['x-kibi-signature']),
				secret,
			)
		) {
			// 401 and no workflow run. Anything else would let a stranger who
			// guessed the URL start workflows, and the URL is not a secret — it
			// travels in the endpoint configuration.
			this.getResponseObject().status(401).send('Invalid signature');

			return { noWebhookResponse: true };
		}

		const body = this.getBodyData() as WebhookEnvelope;

		const selected = this.getNodeParameter('events', []) as string[];
		if (typeof body.event !== 'string' || !matchesSelectedEvents(body.event, selected)) {
			return { webhookResponse: 'OK' };
		}

		if (this.getNodeParameter('ignoreOwnWrites', true) as boolean) {
			const credentials = await this.getCredentials('kibiConnectApi');
			if (isOwnEcho(body.data ?? {}, String(credentials.integrationSlug ?? ''))) {
				return { webhookResponse: 'OK' };
			}
		}

		return {
			workflowData: [
				this.helpers.returnJsonArray([
					{
						...body,
						deliveryId: headerValue(headers['x-kibi-delivery-id']),
						deliveredAt: headerValue(headers['x-kibi-timestamp']),
					},
				]),
			],
		};
	}
}

function autoRegisterEnabled(this: IHookFunctions): boolean {
	return this.getNodeParameter('autoRegister', true) as boolean;
}

function webhookIdOf(this: IHookFunctions): string {
	const node = this.getNode();

	return node.webhookId ?? node.id;
}

/**
 * The events the endpoint is created with.
 *
 * The node treats an empty selection as "everything" (see `filter.ts`), and
 * Kibi refuses an endpoint with no events at all — so an empty selection is
 * turned into the full list Kibi offers, and the local filter still lets
 * everything through.
 */
async function eventsToSubscribe(this: IHookFunctions): Promise<string[]> {
	const selected = this.getNodeParameter('events', []) as string[];

	if (selected.length > 0) {
		return selected;
	}

	const options = await getWebhookEvents.call(this);

	return options.map((option) => String(option.value));
}

/**
 * A lifecycle call to the Kibi API, with the failure rewritten into what to do
 * about it.
 *
 * The original error stays attached as the cause so that `isNotFound` and the
 * n8n UI still see the HTTP status.
 */
async function registrationRequest(
	this: IHookFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<unknown> {
	try {
		return await kibiApiRequest.call(this, method, path, body, qs);
	} catch (error) {
		const failure = extractHttpFailure(error);

		throw new NodeOperationError(this.getNode(), error as Error, {
			message: describeRegistrationError(failure.status, failure.body),
			description:
				'Switch off "Register Webhook Automatically" to create the endpoint in Kibi by hand instead.',
		});
	}
}

/**
 * The secret comes from wherever the setup mode put it.
 *
 * In automatic mode the create call returned it once and it lives in the
 * workflow's static data. In manual mode the user pasted it into the node.
 */
async function resolveSecret(this: IWebhookFunctions): Promise<string> {
	if (this.getNodeParameter('autoRegister', true) as boolean) {
		const staticData = this.getWorkflowStaticData('node');

		return typeof staticData.webhookSecret === 'string' ? staticData.webhookSecret : '';
	}

	return this.getNodeParameter('manualSecret', '') as string;
}

/**
 * The bytes Kibi signed.
 *
 * n8n's body parser keeps them on `rawBody` for JSON requests; when a request
 * arrives without it having been read yet, `readRawBody` fills it in. If
 * neither yields anything, verification is run against an empty body and
 * fails — which is the correct outcome, because there is nothing to prove the
 * signature against.
 */
async function rawBodyOf(request: {
	rawBody?: Buffer;
	readRawBody?: () => Promise<void>;
}): Promise<Buffer> {
	if (request.rawBody === undefined && typeof request.readRawBody === 'function') {
		await request.readRawBody();
	}

	return request.rawBody ?? Buffer.alloc(0);
}

function headerValue(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value;
}
