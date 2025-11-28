/* eslint-disable import/no-unresolved */
import { App, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import {
  SMAResources,
  Infrastructure,
  VoiceConnectorResources,
} from './';

config();

interface AmazonChimeSipCallProps extends StackProps {
  logLevel: string;
}

export class AmazonChimeSDKSipCall extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSipCallProps,
  ) {
    super(scope, id, props);

    const smaResources = new SMAResources(this, `${id}-sma`);
    const voiceConnectorResources = new VoiceConnectorResources(this, `${id}-voice-connector`, {});

    const infrastructure = new Infrastructure(this, `${id}-lambdas`, {
      fromPhoneNumber: smaResources.fromNumber,
      smaId: smaResources.smaId,
      voiceConnector: voiceConnectorResources.voiceConnector,
    });

    new CfnOutput(this, `${id}-api-gateway`, { value: infrastructure.apiUrl });
  }
}

// This is the main execution

const envProps = {
  account: process.env.AWS_ACCOUNT || '199626657728',
  region: process.env.AWS_REGION || 'eu-central-1',
};

const stackProps = {
  logLevel: 'INFO',
};

const app = new App();

new AmazonChimeSDKSipCall(app, 'fcc-sip-call-cdk', {
  ...stackProps,
  env: envProps,
});

app.synth();
