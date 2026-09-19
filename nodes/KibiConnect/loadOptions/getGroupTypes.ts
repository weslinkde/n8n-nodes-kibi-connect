import type { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';

import type { ListResponse } from '../shared/transport';
import { kibiApiRequest } from '../shared/transport';

interface GroupTypeEntry {
	value: string;
	label: string;
	standard: boolean;
}

/**
 * Dropdown for the group types a tenant accepts.
 *
 * Kibi wants the type as a slug, and the slugs of tenant-defined types are
 * not guessable — nothing but this endpoint tells you they exist. Guessing
 * one is the most common 422 on group creation, which is why this is a
 * list rather than a text field.
 */
export async function getGroupTypes(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const response = (await kibiApiRequest.call(
		this,
		'GET',
		'/groups/types',
	)) as ListResponse<GroupTypeEntry>;

	return response.data.map((type) => ({
		name: type.label,
		value: type.value,
		description: type.standard ? 'Standard type' : 'Defined by this tenant',
	}));
}
