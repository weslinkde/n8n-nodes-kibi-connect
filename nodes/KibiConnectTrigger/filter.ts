/**
 * The part of a delivery's `data` the filters look at. Every webhook payload
 * carries this block; see the origin section of Kibi's webhook guide.
 */
export interface OriginBearingData {
	origin?: {
		source?: string;
		integration?: string | null;
	};
}

/**
 * Whether the node is subscribed to this event.
 *
 * The endpoint in Kibi can be subscribed to more events than the node selects
 * — someone widened it in the administration, or the same endpoint serves two
 * workflows. Filtering here keeps the workflow's contract to what its author
 * chose.
 *
 * An empty selection means "everything", not "nothing": a node with no events
 * picked has not been configured yet, and silently receiving nothing is a much
 * harder thing to debug than receiving too much.
 */
export function matchesSelectedEvents(event: string, selected: string[]): boolean {
	return selected.length === 0 || selected.includes(event);
}

/**
 * Whether this delivery is the echo of our own write.
 *
 * Every webhook payload carries `data.origin`: `source` is `"api"` when the
 * change came through the REST API with a token and `"ui"` for anything a
 * person or a background job did, and `integration` is the slug of the token
 * that made the write (`null` when the token has none).
 *
 * A bidirectional workflow writes to Kibi, the webhook comes straight back,
 * and without this check it writes again — forever. Skipping deliveries that
 * carry our own slug is the brake.
 */
export function isOwnEcho(data: OriginBearingData, ownIntegrationSlug: string): boolean {
	if (ownIntegrationSlug === '') {
		return false;
	}

	return data.origin?.integration === ownIntegrationSlug;
}
