import "@whereby.com/assistant-sdk/polyfills";

import fs from "fs";
import { spawn } from "child_process";

import "dotenv/config";
import { Trigger, Assistant, TRIGGER_EVENT_SUCCESS, AUDIO_STREAM_READY, AudioSink } from "@whereby.com/assistant-sdk";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const roomState: Record<string, boolean> = {};

const humanRoles = ["owner", "member", "host", "visitor", "granted_visitor", "viewer", "granted_viewer"];

const trigger = new Trigger({
    webhookTriggers: {
        "room.session.started": ({ data: { subdomain, roomName } }) => {
            const roomStateKey = `${subdomain}${roomName}`;

            return !roomState[roomStateKey];
        },
    },
    port: 3000,
});

trigger.on(
    TRIGGER_EVENT_SUCCESS,
    async ({
        roomUrl,
        triggerWebhook: {
            data: { subdomain, roomName },
        },
    }) => {
        console.log(`Connecting to ${roomUrl}`);

        const assistant = new Assistant({
            assistantKey: process.env.WHEREBY_ASSISTANT_KEY ?? "",
            startCombinedAudioStream: true,
            startLocalMedia: false,
        });

        await assistant.joinRoom(roomUrl);

        const roomStateKey = `${subdomain}${roomName}`;

        console.log("Assistant joined the room");
        roomState[roomStateKey] = true;
        const startTimestamp = new Date().toISOString();

        assistant.on(AUDIO_STREAM_READY, async ({ track }) => {
            // prettier-ignore
            const ffmpegProcess = spawn("ffmpeg", [
                "-hide_banner",
                "-nostats",
                "-loglevel", "verbose",
                "-y",
                "-vn",
                "-acodec", "pcm_s16le",
                "-f", "s16le",
                "-ac", "1",
                "-ar", "48000",
                "-i", "pipe:0",
                `/tmp/audiorecorder-${startTimestamp}.mp3`,
            ]);

            const audioSink = new AudioSink(track);

            const unsubscribeAudioSink = audioSink.subscribe(({ samples, sampleRate }) => {
                if (!ffmpegProcess.stdin.writable) {
                    unsubscribeAudioSink();
                    return;
                }

                ffmpegProcess.stdin.write(samples);
            });

            const roomConnection = assistant.getRoomConnection();

            const unsubscribeFromConnectionStatus = roomConnection.subscribeToConnectionStatus((connectionStatus) => {
                if (["left", "kicked"].includes(connectionStatus)) {
                    unsubscribeFromConnectionStatus();

                    console.log("Assistant left the room");
                    roomState[roomStateKey] = false;

                    if (ffmpegProcess) {
                        ffmpegProcess.stdin.end();
                    }
                }
            });

            const unsubscribeFromRemoteParticipants = roomConnection.subscribeToRemoteParticipants(
                (remoteParticipants) => {
                    const humanParticipants = remoteParticipants.filter(({ roleName }) =>
                        humanRoles.includes(roleName),
                    );

                    // If less than 2 human participants remain, stop recording audio
                    if (humanParticipants.length <= 1) {
                        unsubscribeFromRemoteParticipants();

                        console.log("Assistant leaving the room");
                        roomConnection.leaveRoom();
                    }
                },
            );

            console.log("Started recording audio...");

            const ffmpegProcessCompleted = new Promise((resolve) => {
                ffmpegProcess.on("close", resolve);
            });

            await ffmpegProcessCompleted;

            if (process.env.AWS_S3_ACCESS_KEY_ID && process.env.AWS_S3_SECRET_ACCESS_KEY) {
                console.log("Uploading audio output to S3...");

                const s3OutputFileName = `${roomStateKey}/${startTimestamp}.mp3`;

                const s3Client = new S3Client({
                    credentials: {
                        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID as string,
                        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY as string,
                    },
                    region: process.env.AWS_S3_REGION,
                });

                fs.readFile(`/tmp/audiorecorder-${startTimestamp}.mp3`, (err, data) => {
                    if (err) {
                        throw err;
                    }

                    s3Client
                        .send(
                            new PutObjectCommand({
                                Bucket: process.env.AWS_S3_BUCKET_NAME,
                                Key: s3OutputFileName,
                                Body: data,
                            }),
                        )
                        .then(() => {
                            console.log(
                                `Successfully uploaded audio output to S3 @ ${process.env.AWS_S3_BUCKET_NAME}:${s3OutputFileName}`,
                            );
                        })
                        .catch((error) => {
                            console.error("An error occured uploading to S3.", error);
                        });
                });
            }

            console.log(`Audio recording completed for ${roomUrl}`);
        });
    },
);

trigger.start();
