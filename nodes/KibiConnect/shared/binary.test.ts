import type { IExecuteSingleFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { extractFileName, uploadBinary } from './binary';

describe('extractFileName', () => {
	it('falls back to a generic name without a header', () => {
		expect(extractFileName(undefined)).toBe('download');
	});

	it('reads a plain quoted filename', () => {
		expect(extractFileName('attachment; filename="report.pdf"')).toBe('report.pdf');
	});

	// Kibi titles carry umlauts; the RFC 5987 field is the only lossless one.
	it('prefers the UTF-8 filename over the ASCII fallback', () => {
		expect(
			extractFileName('attachment; filename="Vertrage.pdf"; filename*=UTF-8\'\'Vertr%C3%A4ge.pdf'),
		).toBe('Verträge.pdf');
	});

	it('survives a malformed UTF-8 field', () => {
		expect(extractFileName('attachment; filename="a.pdf"; filename*=UTF-8\'\'%E0%A4%A')).toBe(
			'a.pdf',
		);
	});
});

describe('uploadBinary', () => {
	const context = {
		getNodeParameter: () => 'data',
		helpers: {
			assertBinaryData: () => ({ fileName: 'Bericht.pdf', mimeType: 'application/pdf' }),
			getBinaryDataBuffer: async () => Buffer.from('%PDF-1.7'),
		},
	} as unknown as IExecuteSingleFunctions;

	async function run(body: IHttpRequestOptions['body']): Promise<IHttpRequestOptions> {
		return await uploadBinary.call(context, {
			method: 'POST',
			url: '/files/uploads',
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
			body,
			json: true,
		});
	}

	// The routing engine only builds a multipart body from a real FormData —
	// anything else is JSON-encoded, which would ship the buffer as an array
	// of numbers.
	it('rewrites the request as spec-compliant form data', async () => {
		const options = await run({ folder_ulid: '01J8ZP9K7QW3X2YB5M4N6R8TVC' });
		const form = options.body as unknown as FormData;

		expect(form).toBeInstanceOf(FormData);
		expect(form.get('folder_ulid')).toBe('01J8ZP9K7QW3X2YB5M4N6R8TVC');
		expect(options.json).toBe(false);
		expect(options.headers).not.toHaveProperty('Content-Type');
		expect(options.headers).toHaveProperty('Accept');
	});

	it('attaches the binary under its original name and type', async () => {
		const form = (await run({})).body as unknown as FormData;
		const file = form.get('file') as File;

		expect(file.name).toBe('Bericht.pdf');
		expect(file.type).toBe('application/pdf');
		expect(await file.text()).toBe('%PDF-1.7');
	});

	// Optional fields resolve to undefined or '' when left empty in the
	// editor. Sent as-is they would reach the API as the string "undefined".
	it('drops empty optional fields and stringifies the rest', async () => {
		const form = (
			await run({
				folder_ulid: undefined,
				target_item_ulid: '',
				parent_version_id: 3,
				force: 'conflict_copy',
			})
		).body as unknown as FormData;

		expect(form.has('folder_ulid')).toBe(false);
		expect(form.has('target_item_ulid')).toBe(false);
		expect(form.get('parent_version_id')).toBe('3');
		expect(form.get('force')).toBe('conflict_copy');
	});
});
