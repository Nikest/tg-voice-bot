import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import ffmpeg from 'fluent-ffmpeg';

import dbConnect from '@/lib/mongoose';
import VoiceSettings from '@/models/VoiceSettings';

export async function convertMp3ToOpus(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .audioCodec('libopus')
            .outputOptions([
                "-b:a 32k",
                "-vbr on"
            ])
            .format('ogg')
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
}

export async function POST(req) {
    try {
        await dbConnect();

        const formData = await req.formData();

        const voiceId = formData.get('voiceId');
        const voiceName = formData.get('voiceName');
        const stability = parseFloat(formData.get('stability') || '0');
        const similarityBoost = parseFloat(formData.get('similarityBoost') || '0');
        const style = parseFloat(formData.get('style') || '0');
        const useSpeakerBoost = formData.get('useSpeakerBoost') === 'on';

        const file = formData.get('voiceExample');
        let storedFileName = '';

        if (!voiceId || !voiceName) {
            return NextResponse.json(
                { error: 'voiceId and voiceName is required' },
                { status: 400 }
            );
        }


        if (file && typeof file === 'object' && file.name) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const uploadDir = path.join(process.cwd(), 'public', 'voices');

            await fs.mkdir(uploadDir, { recursive: true });

            const mp3Name = `${Date.now()}_${voiceId}.mp3`;
            const mp3Path = path.join(uploadDir, mp3Name);

            await fs.writeFile(mp3Path, buffer);

            const oggName = `${Date.now()}_${voiceId}.ogg`;
            const oggPath = path.join(uploadDir, oggName);

            try {
                await convertMp3ToOpus(mp3Path, oggPath);
            } catch (err) {
                console.error('[CONVERT] Error:', err);
            }

            await fs.unlink(mp3Path).catch(() => {});

            storedFileName = oggName;
        }

        // --------------------------
        //  SAVE IN MONGO
        // --------------------------
        const doc = await VoiceSettings.create({
            voiceId,
            voiceName,
            stability,
            similarityBoost,
            style,
            useSpeakerBoost,
            exampleFileName: storedFileName,
        });


        return NextResponse.redirect(new URL('/voices', req.url));

    } catch (err) {
        console.error('[VOICE CREATE] Error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
