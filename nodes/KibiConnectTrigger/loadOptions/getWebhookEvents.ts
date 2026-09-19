import type { INodePropertyOptions } from 'n8n-workflow';

import { kibiApiRequest, type KibiRequestContext } from '../../KibiConnect/shared/transport';

/**
 * Loads the events a webhook endpoint can subscribe to.
 *
 * Fetched rather than hardcoded, on Kibi's own advice: the list grows, and a
 * stale copy fails in the quietest possible way — the endpoint is created
 * without complaint and simply never fires for the event that was meant.
 *
 * The contract (`GET /api/v1/webhook-endpoints/events`) is `{ data: { events:
 * [...] } }` with untyped items, so both plain event names and objects that
 * carry a label alongside the name are accepted.
 *
 * Typed against the shared request context rather than `ILoadOptionsFunctions`
 * alone so that the trigger's `create` hook can reuse it when no events were
 * selected and the endpoint has to be subscribed to everything.
 */
export async function getWebhookEvents(this: KibiRequestContext): Promise<INodePropertyOptions[]> {
	const response = (await kibiApiRequest.call(this, 'GET', '/webhook-endpoints/events')) as {
		data?: { events?: unknown[] };
	};

	return (response.data?.events ?? [])
		.map(toEventOption)
		.filter((option): option is INodePropertyOptions => option !== null)
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function toEventOption(entry: unknown): INodePropertyOptions | null {
	if (typeof entry === 'string') {
		return entry === '' ? null : { name: humanize(entry), value: entry };
	}

	if (typeof entry !== 'object' || entry === null) {
		return null;
	}

	const record = entry as Record<string, unknown>;
	const value = [record.value, record.event, record.name].find(
		(candidate): candidate is string => typeof candidate === 'string' && candidate !== '',
	);

	if (value === undefined) {
		return null;
	}

	const label = [record.label, record.name].find(
		(candidate): candidate is string => typeof candidate === 'string' && candidate !== value,
	);

	return {
		name: label ?? humanize(value),
		value,
		...(typeof record.description === 'string' && record.description !== ''
			? { description: record.description }
			: {}),
	};
}

/** `calendar_event.cancelled` reads as `Calendar Event Cancelled` in the picker. */
function humanize(event: string): string {
	return event
		.split(/[._]/)
		.filter((part) => part !== '')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}
