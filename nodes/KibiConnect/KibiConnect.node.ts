import { NodeConnectionTypes, type INodeType, type INodeTypeDescription } from 'n8n-workflow';

import { userDescription } from './resources/user';

export class KibiConnect implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Kibi Connect',
		name: 'kibiConnect',
		icon: {
			light: 'file:../../icons/kibiConnect.svg',
			dark: 'file:../../icons/kibiConnect.dark.svg',
		},
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and write posts, wiki pages, tasks, calendar events and more in Kibi Connect',
		defaults: {
			name: 'Kibi Connect',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'kibiConnectApi',
				required: true,
			},
		],
		// The base URL is per tenant, so it comes from the credential rather
		// than being baked in here — every customer has their own host.
		requestDefaults: {
			baseURL: '={{$credentials.baseUrl}}/api/v1',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'User',
						value: 'user',
					},
				],
				default: 'user',
			},
			...userDescription,
		],
	};
}
