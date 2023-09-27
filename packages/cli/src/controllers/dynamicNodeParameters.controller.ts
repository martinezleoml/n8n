import { Service } from 'typedi';
import type { RequestHandler } from 'express';
import { NextFunction, Response } from 'express';
import type {
	INodeCredentials,
	INodeListSearchResult,
	INodeParameters,
	INodePropertyOptions,
	INodeTypeNameVersion,
	ResourceMapperFields,
} from 'n8n-workflow';
import { jsonParse } from 'n8n-workflow';

import { Authorized, Get, Middleware, RestController } from '@/decorators';
import { getBase } from '@/WorkflowExecuteAdditionalData';
import { DynamicNodeParametersService } from '@/services/dynamicNodeParameters.service';
import { BadRequestError } from '@/ResponseHelper';
import type { AuthenticatedRequest } from '@/requests';

const assertMethodName: RequestHandler = (req, res, next) => {
	const { methodName } = req.query as BaseRequest['query'];
	if (!methodName) {
		throw new BadRequestError('Parameter methodName is required.');
	}
	next();
};

@Service()
@Authorized()
@RestController('/dynamic-node-parameters')
export class DynamicNodeParametersController {
	constructor(private readonly service: DynamicNodeParametersService) {}

	@Middleware()
	parseQueryParams(req: BaseRequest, res: Response, next: NextFunction) {
		const { credentials, currentNodeParameters, nodeTypeAndVersion } = req.query;
		if (!nodeTypeAndVersion) {
			throw new BadRequestError('Parameter nodeTypeAndVersion is required.');
		}
		if (!currentNodeParameters) {
			throw new BadRequestError('Parameter currentNodeParameters is required.');
		}

		req.params = {
			nodeTypeAndVersion: jsonParse(nodeTypeAndVersion),
			currentNodeParameters: jsonParse(currentNodeParameters),
			credentials: credentials ? jsonParse(credentials) : undefined,
		};

		next();
	}

	/** Returns parameter values which normally get loaded from an external API or get generated dynamically */
	@Get('/options')
	async getOptions(req: OptionsRequest): Promise<INodePropertyOptions[]> {
		const { path, methodName, loadOptions } = req.query;
		const { credentials, currentNodeParameters, nodeTypeAndVersion } = req.params;
		const additionalData = await getBase(req.user.id, currentNodeParameters);

		if (methodName) {
			return this.service.getOptionsViaMethodName(
				methodName,
				path,
				additionalData,
				nodeTypeAndVersion,
				currentNodeParameters,
				credentials,
			);
		}

		if (loadOptions) {
			return this.service.getOptionsViaLoadOptions(
				jsonParse(loadOptions),
				additionalData,
				nodeTypeAndVersion,
				currentNodeParameters,
				credentials,
			);
		}

		return [];
	}

	@Get('/resource-locator-results', { middlewares: [assertMethodName] })
	async getResourceLocatorResults(
		req: ResourceLocatorResultsRequest,
	): Promise<INodeListSearchResult | undefined> {
		const { path, methodName, filter, paginationToken } = req.query;
		const { credentials, currentNodeParameters, nodeTypeAndVersion } = req.params;
		const additionalData = await getBase(req.user.id, currentNodeParameters);
		return this.service.getResourceLocatorResults(
			methodName,
			path,
			additionalData,
			nodeTypeAndVersion,
			currentNodeParameters,
			credentials,
			filter,
			paginationToken,
		);
	}

	@Get('/resource-mapper-fields', { middlewares: [assertMethodName] })
	async getResourceMappingFields(
		req: ResourceMapperFieldsRequest,
	): Promise<ResourceMapperFields | undefined> {
		const { path, methodName } = req.query;
		const { credentials, currentNodeParameters, nodeTypeAndVersion } = req.params;
		const additionalData = await getBase(req.user.id, currentNodeParameters);
		return this.service.getResourceMappingFields(
			methodName,
			path,
			additionalData,
			nodeTypeAndVersion,
			currentNodeParameters,
			credentials,
		);
	}
}

type BaseRequest<QueryParams = {}> = AuthenticatedRequest<
	{
		nodeTypeAndVersion: INodeTypeNameVersion;
		currentNodeParameters: INodeParameters;
		credentials?: INodeCredentials;
	},
	{},
	{},
	{
		path: string;
		nodeTypeAndVersion: string;
		currentNodeParameters: string;
		methodName?: string;
		credentials?: string;
	} & QueryParams
>;

/** GET /dynamic-node-parameters/options */
type OptionsRequest = BaseRequest<{
	loadOptions?: string;
}>;

/** GET /dynamic-node-parameters/resource-locator-results */
type ResourceLocatorResultsRequest = BaseRequest<{
	methodName: string;
	filter?: string;
	paginationToken?: string;
}>;

/** GET dynamic-node-parameters/resource-mapper-fields */
type ResourceMapperFieldsRequest = BaseRequest<{
	methodName: string;
}>;
