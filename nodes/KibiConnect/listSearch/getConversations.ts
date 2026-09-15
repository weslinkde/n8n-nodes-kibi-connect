import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import type { ListResponse } from '../shared/transport';
import { kibiApiRequest } from '../shared/transport';

interface ConversationEntry {
	id: string;
	type: string;
	name: string | null;
	unread_count?: number;
	last_message?: { sent_at?: string | null } | null;
}

/**
 * Searchable picker for the conversations the token's own account is in.
 *
 * Two things are worth knowing before using this list:
 *
 * A token sees only the conversations of the person it belongs to. A bot token
 * therefore starts out seeing nothing — somebody has to add that account to a
 * conversation first, or the bot has to open one with `Send Direct Message`.
 *
 * The API has no search parameter here, so the filter is applied locally. That
 * is honest for this endpoint: conversations are returned newest-first and a
 * person has tens of them, not thousands. It is emphatically not how the user
 * picker works, and the difference is deliberate.
 */
export async function getConversations(
	this: ILoadOptionsFunctions,
	filter?: string,
	paginationToken?: string,
): Promise<INodeListSearchResult> {
	const page = paginationToken ? Number(paginationToken) : 1;

	const response = (await kibiApiRequest.call(this, 'GET', '/chat/conversations', undefined, {
		limit: 50,
		page,
	})) as ListResponse<ConversationEntry>;

	const needle = filter?.toLowerCase();

	const results = response.data
		.filter((conversation) => {
			if (!needle) return true;
			return (conversation.name ?? '').toLowerCase().includes(needle);
		})
		.map((conversation) => ({
			name:
				(conversation.name ?? `Conversation ${conversation.id}`) +
				(conversation.type === 'group' ? ' (group)' : ''),
			value: conversation.id,
		}));

	const meta = response.meta;

	return {
		results,
		paginationToken:
			meta && meta.current_page < meta.last_page ? String(meta.current_page + 1) : undefined,
	};
}
