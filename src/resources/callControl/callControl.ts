import { randomUUID } from 'crypto';
import {
  ChimeSDKMeetingsClient,
  CreateMeetingCommand,
  CreateAttendeeCommand,
} from '@aws-sdk/client-chime-sdk-meetings';
import {
  ChimeSDKVoiceClient,
  CreateSipMediaApplicationCallCommand,
} from '@aws-sdk/client-chime-sdk-voice';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const AWS_REGION = process.env.AWS_REGION;
const config = {
  region: AWS_REGION,
};

const chimeSdkVoiceClient = new ChimeSDKVoiceClient(config);
const chimeSdkMeetingsClient = new ChimeSDKMeetingsClient(config);

const voiceConnectorArn = process.env.VOICE_CONNECTOR_ARN || '';
const smaId = process.env.SMA_ID || '';
export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  console.info(`Event: ${JSON.stringify(event)}`);

  const body = JSON.parse(event.body || '{}');
  console.info('Body: ' + JSON.stringify(body));

  let toSipUserEmail = body.toSipUserEmail || '';

  const meetingInfo = await createMeeting(randomUUID());

  if (meetingInfo) {
    const clientAttendeeInfo = await createAttendee(
      meetingInfo.Meeting!.MeetingId!,
      'client-user',
    );

    if (clientAttendeeInfo) {
      const responseInfo = {
        Meeting: meetingInfo.Meeting,
        Attendee: clientAttendeeInfo.Attendee,
      };

      const phoneAttendeeInfo = await createAttendee(
        meetingInfo.Meeting!.MeetingId!,
        'phone-user',
      );

      // Initiate the outbound call
      const dialInfo = await executeDial(
        meetingInfo,
        phoneAttendeeInfo,
        toSipUserEmail,
      );

      console.info('joinInfo: ' + JSON.stringify({ responseInfo, dialInfo }));

      return {
        statusCode: 200,
        body: JSON.stringify({ responseInfo, dialInfo }),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Content-Type': 'application/json',
        },
      };
    } else {
      return {
        statusCode: 503,
        body: 'Error creating attendee',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Content-Type': 'application/json',
        },
      };
    }
  } else {
    return {
      statusCode: 503,
      body: 'Error creating attendee',
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
      },
    };
  }
};

async function executeDial(
  meetingInfo: any,
  outboundAttendeeInfo: any,
  toSipUserEmail: string,
) {
  // For this case, always call VC
  const params = {
    FromPhoneNumber: '+16035550122',
    SipMediaApplicationId: smaId,
    ToPhoneNumber: '+17035550122', // Replace with your desired phone number
    SipHeaders: {
      'X-chime-join-token': outboundAttendeeInfo.Attendee.JoinToken,
      'X-chime-meeting-id': meetingInfo.Meeting.MeetingId,
    },
    ArgumentsMap: {
      MeetingId: meetingInfo.Meeting.MeetingId,
      RequestedDialNumber: '+17035550122',
      RequestedVCArn: voiceConnectorArn,
      RequestorEmail: toSipUserEmail,
      DialVC: 'true',
    },
  };

  console.info('Dial Params: ' + JSON.stringify(params));

  try {
    const dialInfo = await chimeSdkVoiceClient.send(
      new CreateSipMediaApplicationCallCommand(params),
    );
    return dialInfo;
  } catch (err) {
    console.info(`Error: ${err}`);
    return false;
  }
}

async function createMeeting(requestId: string) {
  console.log(`Creating Meeting for Request ID: ${requestId}`);

  try {
    const meetingInfo = await chimeSdkMeetingsClient.send(
      new CreateMeetingCommand({
        ClientRequestToken: requestId,
        MediaRegion: 'eu-central-1',
        ExternalMeetingId: randomUUID(),
      }),
    );

    return meetingInfo;
  } catch (err) {
    console.info(`Error: ${err}`);
    return false;
  }
}

async function createAttendee(meetingId: string, externalUserId: string) {
  console.log(`Creating Attendee for Meeting: ${meetingId}`);

  try {
    const attendeeInfo = await chimeSdkMeetingsClient.send(
      new CreateAttendeeCommand({
        MeetingId: meetingId,
        ExternalUserId: externalUserId,
      }),
    );

    return attendeeInfo;
  } catch (err) {
    console.info(`${err}`);
    return false;
  }
}
