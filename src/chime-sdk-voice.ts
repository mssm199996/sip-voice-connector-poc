import { Duration, Stack } from 'aws-cdk-lib';
import { CfnEIP } from 'aws-cdk-lib/aws-ec2';
import {
  ServicePrincipal,
  Role,
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  ChimeVoiceConnector,
  Protocol,
  ChimeSipMediaApp,
  ChimePhoneNumber,
  PhoneProductType,
  PhoneNumberType,
} from 'cdk-amazon-chime-resources';

import { Construct } from 'constructs';

interface VoiceConnectorResourcesProps {
  sipServerEip?: CfnEIP;
}
export class VoiceConnectorResources extends Construct {
  public readonly voiceConnector: ChimeVoiceConnector;

  constructor(
    scope: Construct,
    id: string,
    props: VoiceConnectorResourcesProps,
  ) {
    super(scope, id);

    let voiceConnector;

    if (props.sipServerEip != undefined) {
      voiceConnector = new ChimeVoiceConnector(
        this,
        'voiceConnector',
        {
          termination: {
            terminationCidrs: [`${props.sipServerEip.ref}/32`],
            callingRegions: ['US'],
          },
          origination: [
            {
              host: props.sipServerEip.ref,
              port: 5060,
              protocol: Protocol.UDP,
              priority: 1,
              weight: 1,
            },
          ],
          encryption: false,
          loggingConfiguration: {
            enableMediaMetricLogs: true,
            enableSIPLogs: true,
          },
        },
      );
    } else {
      voiceConnector = new ChimeVoiceConnector(
        this,
        'voiceConnector',
        {
          encryption: false,
          loggingConfiguration: {
            enableMediaMetricLogs: true,
            enableSIPLogs: true,
          },
        },
      );
    }

    this.voiceConnector = voiceConnector;
  }
}

export class SMAResources extends Construct {
  public readonly fromNumber: string;
  public readonly smaId: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const phoneNumber = new ChimePhoneNumber(this, 'phoneNumber', {
      phoneState: 'IL',
      phoneNumberType: PhoneNumberType.LOCAL,
      phoneProductType: PhoneProductType.SMA,
    });

    const smaHandlerRole = new Role(this, 'smaHandlerRole', {
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

    const smaHandlerLambda = new NodejsFunction(this, 'smaHandlerLambda', {
      entry: 'src/resources/smaHandler/smaHandler.ts',
      handler: 'lambdaHandler',
      runtime: Runtime.NODEJS_20_X,
      role: smaHandlerRole,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(60),
      environment: {
        FROM_NUMBER: phoneNumber.phoneNumber,
      },
    });

    const sipMediaApp = new ChimeSipMediaApp(this, 'sipMediaApp', {
      region: Stack.of(this).region,
      endpoint: smaHandlerLambda.functionArn,
    });

    this.fromNumber = phoneNumber.phoneNumber;
    this.smaId = sipMediaApp.sipMediaAppId;
  }
}
