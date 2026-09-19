import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import type { ListResponse } from '../shared/transport';
import { kibiApiRequest } from '../shared/transport';

interface AbsenceTypeEntry {
	id: string;
	name: string;
	requires_approval?: boolean;
}

/**
 * Dropdown for the kinds of absence a tenant knows.
 *
 * The list is tenant-defined and short — a handful of entries, not pages of
 * them — so it is loaded whole. It exists because the alternative is typing
 * a numeric id that differs between tenants and is not printed anywhere in
 * Kibi's own interface.
 */
export async function getAbsenceTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const response = (await kibiApiRequest.call(
		this,
		'GET',
		'/time-tracking/absence-types',
	)) as ListResponse<AbsenceTypeEntry>;

	return response.data.map((type) => ({
		name: type.name,
		value: type.id,
		// Whether a request of this kind waits for review is the one thing
		// worth knowing before picking it, so it goes on the option itself.
		description:
			type.requires_approval === false ? 'Approved on the spot' : 'Waits for approval',
	}));
}
