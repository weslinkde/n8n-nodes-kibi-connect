import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { KibiConnect } from './KibiConnect.node';
import { kibiRoutingRequest } from './shared/routing';

const description = new KibiConnect().description;
const properties = description.properties;

const resourceValues = (
	(properties[0].options ?? []) as INodePropertyOptions[]
).map((option) => option.value as string);

const operationProperties = properties.filter((property) => property.name === 'operation');

describe('the node description', () => {
	it('registers every resource in the dropdown, in alphabetical order', () => {
		const names = ((properties[0].options ?? []) as INodePropertyOptions[]).map(
			(option) => option.name,
		);

		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
		expect(resourceValues.length).toBeGreaterThanOrEqual(15);
	});

	it('gives every resource exactly one operation property', () => {
		const covered = operationProperties.map(
			(property) => (property.displayOptions?.show?.resource as string[])[0],
		);

		expect([...covered].sort()).toEqual([...resourceValues].sort());
	});

	it('covers the whole v1 contract, the four v2 document reads and the Files API', () => {
		const operations = operationProperties.flatMap(
			(property) => property.options as INodePropertyOptions[],
		);

		// 84 v1 operations + 4 v2 document reads + 41 Files API operations
		expect(operations).toHaveLength(129);
	});

	// The community-node linter checks each of these too, but it runs on the
	// source and stops at the first file with a problem. This runs on what
	// n8n actually loads and reports everything at once.
	it('gives every operation an action and a request', () => {
		for (const property of operationProperties) {
			for (const option of property.options as INodePropertyOptions[]) {
				expect(option.action, `${option.value} has no action`).toBeTruthy();
				expect(option.routing?.request?.method, `${option.value} has no method`).toBeTruthy();
				expect(option.routing?.request?.url, `${option.value} has no url`).toBeTruthy();
			}
		}
	});

	it('only shows fields for resources and operations that exist', () => {
		const operationsOf = new Map(
			operationProperties.map((property) => [
				(property.displayOptions?.show?.resource as string[])[0],
				(property.options as INodePropertyOptions[]).map((option) => option.value),
			]),
		);

		for (const property of properties.slice(1)) {
			if (property.name === 'operation') continue;

			const show = property.displayOptions?.show ?? {};
			const resources = (show.resource ?? []) as string[];
			expect(resources, `${property.name} is not scoped to a resource`).not.toHaveLength(0);

			for (const resource of resources) {
				expect(resourceValues, `${property.name} points at unknown resource ${resource}`).toContain(
					resource,
				);
				for (const operation of (show.operation ?? []) as string[]) {
					expect(
						operationsOf.get(resource),
						`${property.name} points at unknown operation ${resource}.${operation}`,
					).toContain(operation);
				}
			}
		}
	});

	it('points every module-gated resource at the name the error translation expects', () => {
		// `describeApiError` keys its 404 explanation on these two values;
		// renaming a resource would silently drop the explanation.
		expect(resourceValues).toContain('timeTracking');
		expect(resourceValues).toContain('document');
	});

	it('sends the v2 document reads and the Files API to the v2 base URL and everything else to v1', () => {
		expect(description.requestDefaults?.baseURL).toBe('={{$credentials.baseUrl}}/api/v1');

		const v2DocumentReads = ['fulltextSearch', 'getRecent', 'getDocTypes', 'getInbox'];
		const v2Resources = ['file', 'folder', 'shareLink'];

		for (const property of operationProperties) {
			const resource = (property.displayOptions?.show?.resource as string[])[0];

			for (const option of property.options as INodePropertyOptions[]) {
				const baseURL = (option.routing?.request as { baseURL?: string } | undefined)?.baseURL;

				if (
					v2Resources.includes(resource) ||
					(resource === 'document' && v2DocumentReads.includes(option.value as string))
				) {
					expect(baseURL).toBe('={{$credentials.baseUrl}}/api/v2');
				} else {
					expect(baseURL, `${option.value} overrides the base URL`).toBeUndefined();
				}
			}
		}
	});

	it('requests binary downloads as raw buffers', () => {
		const downloads = operationProperties
			.flatMap((property) => property.options as INodePropertyOptions[])
			.filter((option) =>
				(option.routing?.output?.postReceive ?? []).some(
					(action) => typeof action === 'function' && action.name === 'downloadBinary',
				),
			);

		// Document Download, File Download, File Download Version, Shared Wiki Get Media
		expect(downloads.map((option) => option.value).sort()).toEqual([
			'download',
			'download',
			'downloadVersion',
			'getMedia',
		]);

		for (const option of downloads) {
			const request = option.routing?.request as Record<string, unknown>;
			expect(request.encoding).toBe('arraybuffer');
			expect(request.json).toBe(false);
			expect(request.returnFullResponse).toBe(true);
		}
	});

	it('declares the binary input field on every upload', () => {
		const uploads = operationProperties.flatMap((property) =>
			(property.options as INodePropertyOptions[])
				.filter((option) =>
					(option.routing?.send?.preSend ?? []).some((hook) => hook.name === 'uploadBinary'),
				)
				.map((option) => ({
					resource: (property.displayOptions?.show?.resource as string[])[0],
					operation: option.value as string,
				})),
		);

		// Document Create, File Upload, Media Upload
		expect(uploads).toHaveLength(3);

		for (const { resource, operation } of uploads) {
			const field = properties.find(
				(property: INodeProperties) =>
					property.name === 'binaryPropertyName' &&
					(property.displayOptions?.show?.resource as string[]).includes(resource) &&
					(property.displayOptions?.show?.operation as string[]).includes(operation),
			);

			expect(field, `${resource}.${operation} has no binary input field`).toBeDefined();
		}
	});
});

describe('the request executor', () => {
	const unwrapData = [{ type: 'rootProperty', properties: { property: 'data' } }];

	// Both halves are needed for kibiRoutingRequest to run at all: the
	// routing engine calls the pagination function only when `paginate` is
	// set by a displayed parameter, and the Resource parameter is the one
	// every operation displays.
	it('runs every request through kibiRoutingRequest', () => {
		expect(description.requestOperations?.pagination).toBe(kibiRoutingRequest);
		expect(properties[0].name).toBe('resource');
		expect(properties[0].routing?.send?.paginate).toBe(true);
	});

	// The executor unwraps `data` itself while paging, so a list operation
	// that post-processed its records any other way would come out different
	// with Return All on than off.
	it('only pages operations that unwrap data and nothing else', () => {
		const returnAllFields = properties.filter((property) => property.name === 'returnAll');
		expect(returnAllFields.length).toBeGreaterThanOrEqual(20);

		for (const field of returnAllFields) {
			const resource = (field.displayOptions?.show?.resource as string[])[0];
			const operation = (field.displayOptions?.show?.operation as string[])[0];
			const operationProperty = operationProperties.find(
				(property) => (property.displayOptions?.show?.resource as string[])[0] === resource,
			);
			const option = (operationProperty?.options as INodePropertyOptions[]).find(
				(candidate) => candidate.value === operation,
			);

			expect(option, `${resource}.${operation}`).toBeDefined();
			expect(option?.routing?.output?.postReceive, `${resource}.${operation}`).toEqual(unwrapData);
			expect(field.routing?.operations, `${resource}.${operation}`).toBeUndefined();
			expect(String(field.routing?.request?.qs?.limit), `${resource}.${operation}`).toMatch(
				/^=\{\{ \$value \? (50|100) : undefined \}\}$/,
			);
		}
	});

	it('paginates every v1 list that the API pages', () => {
		const paginated = properties
			.filter((property) => property.name === 'returnAll')
			.map(
				(property) =>
					`${(property.displayOptions?.show?.resource as string[])[0]}.${(property.displayOptions?.show?.operation as string[])[0]}`,
			);

		for (const expected of [
			'calendarEvent.getAll',
			'callLink.getAll',
			'chat.getConversations',
			'chat.getMessages',
			'document.getAll',
			'group.getAll',
			'group.getFiles',
			'group.getMembers',
			'group.getPosts',
			'notification.getAll',
			'post.getAll',
			'survey.getAll',
			'task.getAll',
			'user.getAll',
			'wiki.getAll',
		]) {
			expect(paginated, expected).toContain(expected);
		}
	});
});
