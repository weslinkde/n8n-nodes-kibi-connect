import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import type { ListResponse } from '../shared/transport';
import { kibiApiRequest } from '../shared/transport';

interface UserEntry {
	id: string;
	name: string | null;
	department?: string | null;
	position?: string | null;
}

/**
 * Searchable picker for the employee directory.
 *
 * `filter` is handed to the API rather than applied locally: a tenant can have
 * thousands of people, and the list endpoint caps a page at 50. Filtering
 * client-side would quietly show the first 50 names and hide everyone else,
 * which looks like the person is missing rather than like a paging artefact.
 */
export async function getUsers(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const page = paginationToken ? Number(paginationToken) : 1;

	const response = (await kibiApiRequest.call(this, 'GET', '/users', undefined, {
		...(filter ? { search: filter } : {}),
		limit: 50,
		page,
	})) as ListResponse<UserEntry>;

	const meta = response.meta;

	return {
		results: response.data.map((user) => ({
			// Department and position disambiguate the two Müllers a tenant
			// inevitably has; without them the picker shows the same label twice.
			name: [user.name ?? user.id, user.department, user.position]
				.filter((part) => part !== null && part !== undefined && part !== '')
				.join(' — '),
			value: user.id,
		})),
		paginationToken:
			meta && meta.current_page < meta.last_page ? String(meta.current_page + 1) : undefined,
	};
}
