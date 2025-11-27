/* eslint-disable import/no-unresolved */
import { App, CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import {
  SMAResources,
  Infrastructure,
  Site,
  VPCResources,
  VoiceConnectorResources,
} from './';

config();

interface AmazonChimeSDKClickToCallProps extends StackProps {
  buildSipServer: string;
  logLevel: string;
  allowedDomain: string;
  sshPubKey: string;
}

export class AmazonChimeSDKClickToCall extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSDKClickToCallProps,
  ) {
    super(scope, id, props);

    const smaResources = new SMAResources(this, 'SMAResources');

    let voiceConnectorResources;

    if (props.buildSipServer == 'true') {
      const vpcResources = new VPCResources(this, 'VPC');

      voiceConnectorResources = new VoiceConnectorResources(
        this,
        'VoiceConnector',
        {
          sipServerEip: vpcResources.serverEip,
        },
      );

      // TODO: Build a kamailio instance here (or launch a Docker container inside a pod inside K8S)
    } else {
      voiceConnectorResources = new VoiceConnectorResources(this, 'VoiceConnector', {});
    }

    const infrastructure = new Infrastructure(this, 'Infrastructure', {
      fromPhoneNumber: smaResources.fromNumber,
      smaId: smaResources.smaId,
      ...(voiceConnectorResources?.voiceConnector && {
        voiceConnector: voiceConnectorResources.voiceConnector,
      }),
    });

    const site = new Site(this, 'Site', {
      apiUrl: infrastructure.apiUrl,
    });

    new CfnOutput(this, 'smaNumber', { value: smaResources.fromNumber });
    new CfnOutput(this, 'siteBucket', { value: site.siteBucket.bucketName });
    new CfnOutput(this, 'clickToCallSite', {
      value: site.distribution.distributionDomainName,
    });
  }
}

const devEnv = {
  account: '199626657728',
  region: 'eu-central-1',
};

const stackProps = {
  sshPubKey: '',
  allowedDomain: '',
  logLevel: 'INFO',
  buildSipServer: 'false',
};

const app = new App();

new AmazonChimeSDKClickToCall(app, 'Sidi-Mohammed-SIP-POC', {
  ...stackProps,
  env: devEnv,
});

app.synth();
