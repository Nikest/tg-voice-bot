import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

import dbConnect from '@/lib/mongoose';
import NoiseSettings from '@/models/NoiseSettings';
import VoiceSettings from '@/models/VoiceSettings';

export async function GET() {
    try {
        await dbConnect();

        const noises = await NoiseSettings.find();
        const voices = await VoiceSettings.find();

        const missingFiles = [];
        const missingVoiceExamples = [];

        let updatedTagsCount = 0;

        for (const noise of noises) {

            const filePath = path.join(
                process.cwd(),
                'public',
                'voices',
                noise.fileName
            );

            try {
                await fs.access(filePath);
            } catch {
                missingFiles.push({
                    id: String(noise._id),
                    name: noise.name,
                    fileName: noise.fileName,
                    type: 'noise'
                });
            }


            if (Array.isArray(noise.tags) && noise.tags.length > 0) {
                const lowercased = noise.tags
                    .map((t) =>
                        typeof t === 'string'
                            ? t.trim().toLowerCase()
                            : t
                    )
                    .filter((t) => typeof t === 'string' && t.length > 0);

                const uniqueLowercased = Array.from(new Set(lowercased));

                const original = (noise.tags || []).map((t) => String(t));
                if (JSON.stringify(uniqueLowercased) !== JSON.stringify(original)) {
                    noise.tags = uniqueLowercased;
                    await noise.save();
                    updatedTagsCount++;
                }
            }
        }

        for (const voice of voices) {
            if (voice.exampleFileName && voice.exampleFileName.trim() !== '') {
                const filePath = path.join(
                    process.cwd(),
                    'public',
                    'voices',
                    voice.exampleFileName
                );

                try {
                    await fs.access(filePath);
                } catch {
                    missingVoiceExamples.push({
                        id: String(voice._id),
                        voiceId: voice.voiceId,
                        voiceName: voice.voiceName,
                        exampleFileName: voice.exampleFileName,
                        type: 'voice'
                    });
                }
            }
        }

        return NextResponse.json({
            noiseSettings: {
                checkedDocuments: noises.length,
                tagsUpdatedFor: updatedTagsCount,
                missingFiles,
            },
            voiceSettings: {
                checkedDocuments: voices.length,
                missingExampleFiles: missingVoiceExamples,
            },
        });
    } catch (err) {
        return NextResponse.json(
            { error: 'Internal error during db_checking' },
            { status: 500 }
        );
    }
}
