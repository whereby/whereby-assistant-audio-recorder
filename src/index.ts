import "@whereby.com/assistant-sdk/polyfills";

import fs from "fs";
import { spawn } from "child_process";

import "dotenv/config";
import { Trigger, Assistant, TRIGGER_EVENT_SUCCESS, ASSISTANT_LEFT_ROOM } from "@whereby.com/assistant-sdk";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const roomState: Record<string, boolean> = {};

const trigger = new Trigger({
    webhookTriggers: {
        "assistant.requested": ({ data: { subdomain, roomName } }) => {
            const roomStateKey = `${subdomain}${roomName}`;

            return !roomState[roomStateKey];
        },
        "room.session.started": ({ data: { subdomain, roomName } }) => {
            const roomStateKey = `${subdomain}${roomName}`;

            return !roomState[roomStateKey];
        },
    },
    port: parseInt(process.env.SERVICE_PORT || "3000", 10),
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
        });

        try {
            await assistant.joinRoom(roomUrl);
        } catch (error) {
            console.log(`An error occurred connecting to ${roomUrl}`, error);
            return;
        }

        console.log("Assistant joined the room");

        const roomStateKey = `${subdomain}${roomName}`;
        roomState[roomStateKey] = true;

        const startTimestamp = new Date().toISOString();

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

        const combinedAudioSink = assistant.getCombinedAudioSink();

        if (combinedAudioSink) {
            const unsubscribeAudioSink = combinedAudioSink.subscribe(({ samples }) => {
                if (!ffmpegProcess.stdin.writable) {
                    unsubscribeAudioSink();
                    return;
                }

                ffmpegProcess.stdin.write(samples);
            });
        }

        console.log("Started recording audio...");

        ffmpegProcess.on("close", () => {
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

        assistant.on(ASSISTANT_LEFT_ROOM, () => {
            console.log("Assistant left the room");
            roomState[roomStateKey] = false;

            if (ffmpegProcess) {
                ffmpegProcess.stdin.end();
            }
        });
    },
);

trigger.start();
