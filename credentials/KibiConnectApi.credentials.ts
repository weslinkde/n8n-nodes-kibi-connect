import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class KibiConnectApi implements ICredentialType {
	name = 'kibiConnectApi';

	displayName = 'Kibi Connect API';

	icon: Icon = {
		light: 'file:../icons/kibiConnect.svg',
		dark: 'file:../icons/kibiConnect.dark.svg',
	};

	documentationUrl = 'https://github.com/weslinkde/n8n-nodes-kibi-connect#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://acme.kibi.de',
			description:
				'The address of your Kibi Connect tenant. No trailing slash, and without /api — the node appends the API path itself',
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Create one in Kibi under My Profile > Integrations, and grant it the scopes the operations you plan to use need. Tokens cannot be edited afterwards — a missing scope means a new token',
		},
		{
			displayName: 'Integration Slug',
			name: 'integrationSlug',
			type: 'string',
			default: '',
			description:
				'The slug chosen when the token was created. Only the trigger node needs it: to register its own webhook, and to skip the events this integration caused itself. Leave empty if the token has none',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials?.apiToken}}',
			},
		},
	};

	// The rules matter more than the request does. Kibi answers 403 for three
	// unrelated reasons, and only two of them mean the credential is broken.
	// Without the scope rule a perfectly good narrow-scoped token would be
	// reported as invalid and its owner would go looking in the wrong place.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}/api/v1',
			url: '/users',
			method: 'GET',
			qs: { limit: 1 },
		},
		rules: [
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'error',
					value: 'Insufficient scope',
					message:
						'The token works. It just does not carry the users:read scope this test uses — grant that scope, or ignore this if the operations you need are covered by the scopes it does have.',
				},
			},
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'error',
					value: 'API disabled',
					message:
						'The REST API is switched off for this tenant. A system administrator turns it on under Administration > API.',
				},
			},
			{
				type: 'responseSuccessBody',
				properties: {
					key: 'error',
					value: 'IP not allowed',
					message:
						"This n8n instance's IP address is not on the tenant's allow list. A system administrator maintains it under Administration > API.",
				},
			},
		],
	};
}
