import ffmpeg from 'fluent-ffmpeg';
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg';
import { PassThrough } from 'stream';

ffmpeg.setFfmpegPath(ffmpegPath);

const EQ_FILTER_CHAIN = [
    'lowshelf=f=90:g=12.7',
    'equalizer=f=1500:w=1:g=5.9',
    'highshelf=f=8000:g=-8.2',
    'alimiter=level_in=1:level_out=0.95:limit=0.95:attack=5:release=50'
].join(',');

export async function convertToTelegramVoice(inputBuffer) {
    return new Promise((resolve, reject) => {

        const outputStream = new PassThrough();
        const inputStream = new PassThrough();

        inputStream.end(inputBuffer);

        const chunks = [];

        outputStream.on('data', (chunk) => chunks.push(chunk));
        outputStream.on('end', () => {
            const resultBuffer = Buffer.concat(chunks);
            if (resultBuffer.length === 0) {
                return reject(new Error('FFmpeg conversion resulted in empty buffer'));
            }
            resolve(resultBuffer);
        });
        outputStream.on('error', reject);

        ffmpeg(inputStream)
            .inputFormat('ogg')
            .audioFilters(EQ_FILTER_CHAIN)
            .audioCodec('libopus')
            .format('ogg')
            .outputOptions([
                '-ac 1',
                '-ar 24000',
                '-application voip',
                '-b:a 32k'
            ])
            .on('error', (err) => {
                console.error('FFmpeg Error Details:', err.message);
                reject(err);
            })
            .pipe(outputStream, { end: true });
    });
}