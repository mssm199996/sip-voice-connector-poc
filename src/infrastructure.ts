import { Stack, Duration } from 'aws-cdk-lib';
import {
  RestApi,
  LambdaIntegration,
  EndpointType,
  MethodLoggingLevel,
} from 'aws-cdk-lib/aws-apigateway';
import {
  ManagedPolicy,
  Role,
  PolicyStatement,
  PolicyDocument,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  ChimeVoiceConnector,
} from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

interface InfrastructureProps {
  readonly fromPhoneNumber: string;
  readonly smaId: string;
  readonly voiceConnector?: ChimeVoiceConnector;
}

export class Infrastructure extends Construct {
  public readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: InfrastructureProps) {
    super(scope, id);

    const infrastructureRole = new Role(this, 'infrastructureRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['chimePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['chime:*'],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });
    const callControlLambda = new NodejsFunction(this, 'callControlLambda', {
      entry: 'src/resources/callControl/callControl.ts',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      role: infrastructureRole,
      timeout: Duration.seconds(60),
      environment: {
        SMA_ID: props.smaId,
        FROM_NUMBER: props.fromPhoneNumber,
        VOICE_CONNECTOR_ARN:
          `arn:aws:chime:${Stack.of(this).region}:${
            Stack.of(this).account
          }:vc/${props.voiceConnector!.voiceConnectorId}` || '',
      },
    });

    const updateCallLambda = new NodejsFunction(this, 'updateCallLambda', {
      entry: 'src/resources/updateCall/updateCall.ts',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      role: infrastructureRole,
      timeout: Duration.seconds(60),
      environment: {
        SMA_ID: props.smaId,
        FROM_NUMBER: props.fromPhoneNumber,
        VOICE_CONNECTOR_ARN:
          `arn:aws:chime:${Stack.of(this).region}:${
            Stack.of(this).account
          }:vc/${props.voiceConnector!.voiceConnectorId}` || '',
      },
    });

    const api = new RestApi(this, 'clickToCallApi', {
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: ['OPTIONS', 'POST'],
        allowCredentials: true,
        allowOrigins: ['*'],
      },
      deployOptions: {
        loggingLevel: MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
      endpointConfiguration: {
        types: [EndpointType.REGIONAL],
      },
    });

    const apiKey = api.addApiKey('ClickToCallApiKey', {
      apiKeyName: 'click-to-call-api-key',
    });

    const plan = api.addUsagePlan('UsagePlan', {
      name: 'ClickToCallUsagePlan',
      throttle: {
        rateLimit: 100,
        burstLimit: 20,
      },
    });

    plan.addApiKey(apiKey);
    plan.addApiStage({
      stage: api.deploymentStage,
    });

    const dial = api.root.addResource('dial');
    const update = api.root.addResource('update');

    const callControlIntegration = new LambdaIntegration(callControlLambda);
    const updateCallIntegration = new LambdaIntegration(updateCallLambda);

    dial.addMethod('POST', callControlIntegration, {
      apiKeyRequired: true,
    });
    update.addMethod('POST', updateCallIntegration, {
      apiKeyRequired: true,
    });

    this.apiUrl = api.url;
  }
}
