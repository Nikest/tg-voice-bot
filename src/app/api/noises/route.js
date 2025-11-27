import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import crypto from 'crypto';

import dbConnect from '@/lib/mongoose';
import NoiseSettings from '@/models/NoiseSettings';


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
        const tagsRaw = formData.get('tags') || '';
        const file = formData.get('noiseFile');

        if (!file || typeof file !== 'object' || !file.name) {
            return NextResponse.json(
                { error: 'File is required' },
                { status: 400 }
            );
        }


        const hash = crypto.randomBytes(8).toString('hex');
        const uniqueName = `noise_${hash}`;

        const tagsArray = tagsRaw
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);


        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadDir = path.join(process.cwd(), 'public', 'voices');
        await fs.mkdir(uploadDir, { recursive: true });

        const tempName = `${uniqueName}_temp${path.extname(file.name)}`;
        const tempPath = path.join(uploadDir, tempName);

        const finalFileName = `${uniqueName}.ogg`;
        const finalPath = path.join(uploadDir, finalFileName);

        await fs.writeFile(tempPath, buffer);
        console.log('[NOISE UPLOAD] Saved Temp:', tempPath);


        try {
            await convertMp3ToOpus(tempPath, finalPath);
            console.log('[NOISE CONVERT] Created OGG:', finalPath);
        } catch (err) {
            console.error('[NOISE CONVERT] Error:', err);
            await fs.unlink(tempPath).catch(() => {});
            return NextResponse.json({ error: 'Conversion failed' }, { status: 500 });
        }

        await fs.unlink(tempPath).catch(() => {});



        const doc = await NoiseSettings.create({
            name: uniqueName,
            fileName: finalFileName,
            tags: tagsArray,
        });

        console.log('[NOISE] Created new noise entry:', doc.name);

        return NextResponse.redirect(new URL('/noises', req.url));

    } catch (err) {
        console.error('[NOISE CREATE] Error:', err);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}