import type { INodeProperties } from 'n8n-workflow';

import { returnAll, unwrapData } from '../../shared/descriptions';
import { ulidField } from '../../shared/fields';

const R = 'survey';
const show = { resource: [R] };

export const surveyDescription: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show },
		options: [
			{
				name: 'Get',
				value: 'get',
				action: 'Get a survey',
				description: 'Read one published survey, including all its answer options',
				routing: {
					request: { method: 'GET', url: '=/surveys/{{$parameter.surveyId}}' },
					output: { postReceive: unwrapData },
				},
			},
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many surveys',
				description: 'Read the published surveys visible to the token owner, with their answer options',
				routing: {
					request: { method: 'GET', url: '/surveys' },
					output: { postReceive: unwrapData },
				},
			},
		],
		default: 'getAll',
	},

	{
		displayName:
			'Surveys are read-only through the API: the questions and answer options come back, but answers cannot be submitted or counted from here.',
		name: 'readOnlyNotice',
		type: 'notice',
		default: '',
		displayOptions: { show },
	},

	ulidField('Survey ID', 'surveyId', R, ['get'], 'The survey to read.'),

	...returnAll(R, 'getAll'),
];
