import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyKibiSignature } from './verify';

const SECRET = 'kbw_test_secret';

function sign(body: string, secret = SECRET): string {
	return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('verifyKibiSignature', () => {
	const body = JSON.stringify({ event: 'post.created', data: { id: '01ABC' } });

	it('accepts a correct signature', () => {
		expect(verifyKibiSignature(body, sign(body), SECRET)).toBe(true);
	});

	// The whole point of hashing the RAW body: re-serialising the parsed JSON
	// reorders keys and changes whitespace, and the digest no longer matches.
	it('rejects a body altered by one character', () => {
		expect(verifyKibiSignature(body.replace('01ABC', '01ABD'), sign(body), SECRET)).toBe(false);
	});

	it('rejects a signature made with a different secret', () => {
		expect(verifyKibiSignature(body, sign(body, 'kbw_other'), SECRET)).toBe(false);
	});

	// Right length, wrong content: the case a constant-time comparison exists for.
	it('rejects a signature of the right length but wrong content', () => {
		const forged = `sha256=${'0'.repeat(64)}`;

		expect(forged.length).toBe(sign(body).length);
		expect(verifyKibiSignature(body, forged, SECRET)).toBe(false);
	});

	it('rejects a missing signature', () => {
		expect(verifyKibiSignature(body, undefined, SECRET)).toBe(false);
	});

	it('rejects an empty signature header', () => {
		expect(verifyKibiSignature(body, '', SECRET)).toBe(false);
	});

	it('rejects a signature without the sha256= prefix', () => {
		expect(verifyKibiSignature(body, sign(body).slice('sha256='.length), SECRET)).toBe(false);
	});

	// timingSafeEqual throws on differing lengths. A truncated header must be
	// a plain false, not an exception that turns into a 500 and tells the
	// sender their payload broke us.
	it('rejects a truncated signature without throwing', () => {
		expect(() => verifyKibiSignature(body, 'sha256=abcd', SECRET)).not.toThrow();
		expect(verifyKibiSignature(body, 'sha256=abcd', SECRET)).toBe(false);
	});

	it('rejects an empty secret', () => {
		expect(verifyKibiSignature(body, sign(body), '')).toBe(false);
	});

	it('accepts a Buffer body', () => {
		expect(verifyKibiSignature(Buffer.from(body), sign(body), SECRET)).toBe(true);
	});

	it('rejects an empty body signed as something else', () => {
		expect(verifyKibiSignature('', sign(body), SECRET)).toBe(false);
	});
});
