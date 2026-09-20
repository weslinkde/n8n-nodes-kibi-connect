import type { INodeProperties, INodePropertyCollection } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { KibiConnect } from '../KibiConnect.node';

/**
 * Every moment this node sends — a due date, a meeting time, an expiry, a
 * change-feed watermark — travels as a full ISO 8601 timestamp including its
 * offset. The editor's value is an instant, and both halves of the old
 * handling lost part of it: passing the raw value on left the offset for the
 * API to interpret, and cutting the string after the date dropped the time
 * of day along with, in a tenant east of UTC, the last two hours of the day.
 *
 * The day-only fields of Time Tracking and the calendar filters are a
 * different thing: those API parameters are calendar days, not moments, and
 * are deliberately left alone here.
 */
const MOMENT_PARAMETERS = ['due_date', 'scheduled_at', 'expires_at', 'updated_since'];

const FULL_ISO = /^=\{\{ \$value \? new Date\(\$value\)\.toISOString\(\) : (undefined|null) \}\}$/;

interface Found {
	label: string;
	parameter: string;
	expression: string;
	note: string;
}

/** Walk the node's properties, descending into collections. */
function collect(properties: INodeProperties[], path: string): Found[] {
	const found: Found[] = [];

	for (const property of properties) {
		const label = `${path}.${property.name}`;

		if (property.type === 'collection' || property.type === 'fixedCollection') {
			const options = (property.options ?? []) as Array<
				INodeProperties | INodePropertyCollection
			>;
			for (const option of options) {
				if ('values' in option) {
					found.push(...collect(option.values, label));
				} else {
					found.push(...collect([option as INodeProperties], label));
				}
			}
			continue;
		}

		if (property.type !== 'dateTime') continue;

		const request = (property.routing?.request ?? {}) as {
			body?: Record<string, unknown>;
			qs?: Record<string, unknown>;
		};

		for (const [parameter, expression] of [
			...Object.entries(request.body ?? {}),
			...Object.entries(request.qs ?? {}),
		]) {
			if (!MOMENT_PARAMETERS.includes(parameter)) continue;

			found.push({
				label,
				parameter,
				expression: String(expression),
				note: `${String(property.hint ?? '')} ${String(property.description ?? '')}`,
			});
		}
	}

	return found;
}

const moments = collect(new KibiConnect().description.properties, 'kibiConnect');

describe('date and time fields', () => {
	// Four resources carry one: Task, Call Link, File, Folder, Share Link,
	// plus the Changed Since of every change feed.
	it('finds the fields that send a moment', () => {
		expect(moments.length).toBeGreaterThanOrEqual(10);
		for (const parameter of MOMENT_PARAMETERS) {
			expect(
				moments.map((moment) => moment.parameter),
				parameter,
			).toContain(parameter);
		}
	});

	it('sends every moment as a full ISO 8601 timestamp', () => {
		for (const moment of moments) {
			expect(moment.expression, `${moment.label} -> ${moment.parameter}`).toMatch(FULL_ISO);
			expect(moment.expression, `${moment.label} -> ${moment.parameter}`).not.toContain('slice');
		}
	});

	// A hint that says "UTC expected" would be wrong the moment the API
	// honours the offset. This one stays true either way.
	it('says on every field that the value carries its time zone', () => {
		for (const moment of moments) {
			expect(moment.note, `${moment.label} -> ${moment.parameter}`).toContain('ISO 8601');
			expect(moment.note, `${moment.label} -> ${moment.parameter}`).toMatch(/time zone/i);
		}
	});
});
