import { describe, expect, it } from 'vitest';

import { extractFileName } from './binary';

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
