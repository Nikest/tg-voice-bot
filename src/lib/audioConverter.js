import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');


const EQ_SETTINGS = [
    'lowshelf=f=90:g=3.5',
    'equalizer=f=1500:width_type=o:width=1:g=3.2',
    'highshelf=f=8000:g=-3.0',
    'alimiter=level_in=1:level_out=0.95:limit=0.95:attack=5:release=50'
].join(',');

export async function convertToTelegramVoice(inputBuffer, noisePath = null, noiseVolume = "1.35") {
    return new Promise((resolve, reject) => {
        const outputStream = new PassThrough();
        const inputStream = new PassThrough();

        inputStream.on('error', (err) => console.error('[Stream] Input Error:', err));
        outputStream.on('error', (err) => console.error('[Stream] Output Error:', err));

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


        let command = ffmpeg()
            .input(inputStream)
            .inputFormat('mp3');

        if (noisePath) {
            console.log(`[FFmpeg] Mixing with noise: ${noisePath}`);

            command
                .input(noisePath)
                .inputOptions(['-stream_loop -1'])
                .complexFilter([

                    `[0:a]${EQ_SETTINGS}[voice_eq]`,
                    `[1:a]aformat=channel_layouts=mono,volume=${noiseVolume}[noise_low]`,
                    `[voice_eq][noise_low]amix=inputs=2:duration=first:dropout_transition=2[out]`
                ])
                .map('[out]');
        } else {
            console.log('[FFmpeg] Applying EQ only (no noise)');
            command.audioFilters(EQ_SETTINGS);
        }

        command
            .on('stderr', (line) => console.log('[FFmpeg Log]:', line))
            .audioCodec('libopus')
            .format('ogg')
            .outputOptions([
                '-ac 1',
                '-ar 24000',
                '-b:a 24k',
                '-application voip'
            ])
            .on('error', (err) => reject(err))
            .pipe(outputStream, { end: true });
    });
}