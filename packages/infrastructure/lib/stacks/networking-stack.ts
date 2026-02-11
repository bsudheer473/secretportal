import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface NetworkingStackProps {
  userPool: cognito.UserPool;
  authorizerFunction?: lambda.Function;
  secretsFunction?: lambda.Function;
}

/**
 * Networking stack - API Gateway
 * API Gateway with Lambda authorizer and request/response models
 */
export class NetworkingStack extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly authorizer?: apigateway.TokenAuthorizer;

  constructor(scope: Construct, id: string, props: NetworkingStackProps) {
    super(scope, id);

    // API Gateway REST API
    this.api = new apigateway.RestApi(this, 'SecretsPortalApi', {
      restApiName: 'Secrets Portal API',
      description: 'API for Secrets Management Portal',
      deployOptions: {
        stageName: 'prod',
        metricsEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Create Lambda authorizer if function is provided
    if (props.authorizerFunction) {
      this.authorizer = new apigateway.TokenAuthorizer(this, 'ApiAuthorizer', {
        handler: props.authorizerFunction,
        identitySource: 'method.request.header.Authorization',
        authorizerName: 'CognitoJwtAuthorizer',
        resultsCacheTtl: cdk.Duration.minutes(5),
      });
    }

    // Create request/response models for validation
    this.createModels();

    // Create API resources and methods if secrets function is provided
    if (props.secretsFunction && this.authorizer) {
      this.createApiResources(props.secretsFunction);
    }
  }

  /**
   * Create JSON schema models for request/response validation
   */
  private createModels(): void {
    // Create Secret Request Model
    this.api.addModel('CreateSecretRequest', {
      contentType: 'application/json',
      modelName: 'CreateSecretRequest',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['name', 'application', 'environment', 'rotationPeriod', 'value'],
        properties: {
          name: { type: apigateway.JsonSchemaType.STRING },
          application: { type: apigateway.JsonSchemaType.STRING },
          environment: { 
            type: apigateway.JsonSchemaType.STRING,
            enum: ['NP', 'PP', 'Prod'],
          },
          rotationPeriod: { 
            type: apigateway.JsonSchemaType.INTEGER,
            enum: [45, 60, 90],
          },
          value: { type: apigateway.JsonSchemaType.STRING },
          description: { type: apigateway.JsonSchemaType.STRING },
          owner: { type: apigateway.JsonSchemaType.STRING },
        },
      },
    });

    // Update Secret Request Model
    this.api.addModel('UpdateSecretRequest', {
      contentType: 'application/json',
      modelName: 'UpdateSecretRequest',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['value'],
        properties: {
          value: { type: apigateway.JsonSchemaType.STRING },
        },
      },
    });

    // Update Rotation Period Request Model
    this.api.addModel('UpdateRotationPeriodRequest', {
      contentType: 'application/json',
      modelName: 'UpdateRotationPeriodRequest',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['rotationPeriod'],
        properties: {
          rotationPeriod: { 
            type: apigateway.JsonSchemaType.INTEGER,
            enum: [45, 60, 90],
          },
        },
      },
    });

    // Error Response Model
    this.api.addModel('ErrorResponse', {
      contentType: 'application/json',
      modelName: 'ErrorResponse',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        properties: {
          error: {
            type: apigateway.JsonSchemaType.OBJECT,
            properties: {
              code: { type: apigateway.JsonSchemaType.STRING },
              message: { type: apigateway.JsonSchemaType.STRING },
              details: { type: apigateway.JsonSchemaType.OBJECT },
            },
          },
        },
      },
    });
  }

  /**
   * Create API Gateway resources and methods
   */
  private createApiResources(secretsFunction: lambda.Function): void {
    if (!this.authorizer) {
      throw new Error('Authorizer must be configured before creating API resources');
    }

    // Common error responses for all methods
    const errorResponses = [
      { statusCode: '400' },
      { statusCode: '401' },
      { statusCode: '403' },
      { statusCode: '404' },
      { statusCode: '500' },
      { statusCode: '503' },
    ];

    // Lambda integration for secrets function
    const secretsIntegration = new apigateway.LambdaIntegration(secretsFunction, {
      proxy: true,
    });

    // /secrets resource
    const secretsResource = this.api.root.addResource('secrets');

    // GET /secrets - List secrets
    secretsResource.addMethod('GET', secretsIntegration, {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      requestParameters: {
        'method.request.querystring.application': false,
        'method.request.querystring.environment': false,
        'method.request.querystring.limit': false,
        'method.request.querystring.nextToken': false,
      },
      methodResponses: [
        { statusCode: '200' },
        ...errorResponses,
      ],
    });

    // POST /secrets - Create secret
    secretsResource.addMethod('POST', secretsIntegration, {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      requestValidator: new apigateway.RequestValidator(this, 'CreateSecretValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: false,
      }),
      methodResponses: [
        { statusCode: '200' },
        ...errorResponses,
      ],
    });

    // /secrets/search resource
    const searchResource = secretsResource.addResource('search');

    // GET /secrets/search - Search secrets
    searchResource.addMethod('GET', secretsIntegration, {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      requestParameters: {
        'method.request.querystring.q': true,
        'method.request.querystring.limit': false,
        'method.request.querystring.nextToken': false,
      },
      requestValidator: new apigateway.RequestValidator(this, 'SearchSecretsValidator', {
        restApi: this.api,
        validateRequestBody: false,
        validateRequestParameters: true,
      }),
      methodResponses: [
        { statusCode: '200' },
        ...errorResponses,
      ],
    });

    // /secrets/{id} resource
    const secretIdResource = secretsResource.addResource('{id}');

    // GET /secrets/{id} - Get secret metadata
    secretIdResource.addMethod('GET', secretsIntegration, {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      requestParameters: {
        'method.request.path.id': true,
      },
      requestValidator: new apigateway.RequestValidator(this, 'GetSecretValidator', {
        restApi: this.api,
        validateRequestBody: false,
        validateRequestParameters: true,
      }),
      methodResponses: [
        { statusCode: '200' },
        ...errorResponses,
      ],
    });

    // PUT /secrets/{id} - Update secret
    secretIdResource.addMethod('PUT', secretsIntegration, {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      requestParameters: {
        'method.request.path.id': true,
      },
      requestValidator: new apigateway.RequestValidator(this, 'UpdateSecretValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      methodResponses: [
        { statusCode: '200' },
        ...errorResponses,
      ],
    });

    // /secrets/{id}/console-url resource
    const consoleUrlResource = secretIdResource.addResource('console-url');

    // GET /secrets/{id}/console-url - Get AWS console URL
    consoleUrlResource.addMethod('GET', secretsIntegration, {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      requestParameters: {
        'method.request.path.id': true,
      },
      requestValidator: new apigateway.RequestValidator(this, 'GetConsoleUrlValidator', {
        restApi: this.api,
        validateRequestBody: false,
        validateRequestParameters: true,
      }),
      methodResponses: [
        { statusCode: '200' },
        ...errorResponses,
      ],
    });

    // /secrets/{id}/rotation resource
    const rotationResource = secretIdResource.addResource('rotation');

    // PUT /secrets/{id}/rotation - Update rotation period
    rotationResource.addMethod('PUT', secretsIntegration, {
      authorizer: this.authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      requestParameters: {
        'method.request.path.id': true,
      },
      requestValidator: new apigateway.RequestValidator(this, 'UpdateRotationValidator', {
        restApi: this.api,
        validateRequestBody: true,
        validateRequestParameters: true,
      }),
      methodResponses: [
        { statusCode: '200' },
        ...errorResponses,
      ],
    });
  }
}
