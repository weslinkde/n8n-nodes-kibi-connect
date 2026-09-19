import { createHmac, timingSafeEqual } from 'node:crypto';

const SIGNATURE_PREFIX = 'sha256=';

/**
 * Verifies the `X-Kibi-Signature` header against the raw request body.
 *
 * Kibi signs `HMAC-SHA256(rawBody, endpointSecret)` and sends it as
 * `sha256=<hex>`.
 *
 * Two details are the whole substance of this function:
 *
 *  - It has to hash the **raw** bytes. n8n hands the parsed object to
 *    `getBodyData()`, and re-serialising that produces different bytes — key
 *    order, whitespace and PHP's escaped slashes are not preserved — so the
 *    digest would never match. The raw body is on `getRequestObject().rawBody`.
 *  - `timingSafeEqual` throws when the buffers differ in length, which for a
 *    truncated or absent header would surface as a 500 rather than a
 *    rejection. Compare the lengths first, and never let an exception out.
 *
 * Uses only Node's own crypto. Verified community nodes may not carry runtime
 * dependencies.
 */
export function verifyKibiSignature(
	rawBody: Buffer | string,
	signatureHeader: string | undefined,
	secret: string,
): boolean {
	if (typeof signatureHeader !== 'string' || signatureHeader === '' || secret === '') {
		return false;
	}

	if (!signatureHeader.startsWith(SIGNATURE_PREFIX)) {
		return false;
	}

	const provided = Buffer.from(signatureHeader.slice(SIGNATURE_PREFIX.length));
	const expected = Buffer.from(
		createHmac('sha256', secret)
			.update(typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody)
			.digest('hex'),
	);

	if (provided.length !== expected.length) {
		return false;
	}

	try {
		return timingSafeEqual(provided, expected);
	} catch {
		return false;
	}
}
