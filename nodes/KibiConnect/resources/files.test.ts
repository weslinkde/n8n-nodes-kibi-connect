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

	// The walk over the pages lives in kibiRoutingRequest; the parameter's
	// job is to ask for the Files API's largest page.
	it('asks for the largest page the Files API allows when everything is wanted', () => {
		expect(paginated.length).toBeGreaterThan(0);
		for (const p of paginated) {
			expect(p.routing?.request?.qs).toEqual({ limit: '={{ $value ? 100 : undefined }}' });
			expect(p.routing?.operations).toBeUndefined();
		}
	});

	it('paginates the listings and nothing else', () => {
		const ops = paginated.map(
			(p) => `${p.displayOptions?.show?.resource}.${p.displayOptions?.show?.operation}`,
		);

		expect(ops.sort()).toEqual([
			'file.getActivity',
			'file.getAll',
			'file.getRecent',
			'file.getTrash',
			'file.search',
			'folder.getItems',
			'shareLink.getAccesses',
			'shareLink.getAll',
		]);
	});
});
