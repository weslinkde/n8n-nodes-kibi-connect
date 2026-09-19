import type { INodeProperties, INodePropertyOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { FILES_BASE_URL } from '../shared/descriptions';
import { fileDescription } from './file';
import { folderDescription } from './folder';
import { shareLinkDescription } from './shareLink';

const resources: Array<[string, INodeProperties[]]> = [
	['file', fileDescription],
	['folder', folderDescription],
	['shareLink', shareLinkDescription],
];

function operationsOf(properties: INodeProperties[]): INodePropertyOptions[] {
	const operation = properties.find((p) => p.name === 'operation');
	return (operation?.options ?? []) as INodePropertyOptions[];
}

describe.each(resources)('%s resource', (resource, properties) => {
	const operations = operationsOf(properties);

	// requestDefaults.baseURL points at v1. An operation without the override
	// would hit /api/v1/files/... and get a 404 that looks like a permission
	// problem.
	it('routes every operation to the v2 base URL', () => {
		for (const op of operations) {
			expect(op.routing?.request?.baseURL, op.value as string).toBe(FILES_BASE_URL);
		}
	});

	it('gives every operation an action and a description', () => {
		for (const op of operations) {
			expect(op.action, op.value as string).toBeTruthy();
			expect(op.description, op.value as string).toBeTruthy();
		}
	});

	it('lists the operations alphabetically', () => {
		const names = operations.map((op) => op.name);
		expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
	});

	it('only shows fields for operations that exist', () => {
		const values = new Set(operations.map((op) => op.value));

		for (const property of properties) {
			if (property.name === 'operation') continue;
			const shown = property.displayOptions?.show?.operation ?? [];
			for (const value of shown) {
				expect(values.has(value as string), `${property.name} -> ${String(value)}`).toBe(true);
			}
			expect(property.displayOptions?.show?.resource).toEqual([resource]);
		}
	});
});

describe('pagination', () => {
	const paginated = [...fileDescription, ...folderDescription, ...shareLinkDescription].filter(
		(p) => p.name === 'returnAll',
	);

	// The routing engine only pages when `send.paginate` is set — the
	// pagination block alone does nothing.
	it('switches paging on through the Return All value', () => {
		expect(paginated.length).toBeGreaterThan(0);
		for (const p of paginated) {
			expect(p.routing?.send?.paginate).toBe('={{ $value }}');
		}
	});

	// The pagination request replaces the query string wholesale, so the
	// filters have to be carried over explicitly or page two comes back
	// unfiltered.
	it('carries the original query string into every page request', () => {
		for (const p of paginated) {
			const pagination = p.routing?.operations?.pagination;
			expect(pagination).toBeDefined();
			if (pagination === undefined || typeof pagination === 'function') continue;
			const qs = (pagination.properties as { request: { qs: string } }).request.qs;
			expect(qs).toContain('...$request.qs');
			expect(qs).toContain('limit: 100');
		}
	});

	it('uses the cursor envelope for the share-link listings only', () => {
		const cursorOps = paginated
			.filter((p) => JSON.stringify(p.routing?.operations).includes('next_cursor'))
			.map((p) => `${p.displayOptions?.show?.resource}.${p.displayOptions?.show?.operation}`);

		expect(cursorOps.sort()).toEqual(['shareLink.getAccesses', 'shareLink.getAll']);
	});
});
