import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';

ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');


const EQ_SETTINGS = [
    'lowshelf=f=90:g=3.5',
    'equalizer=f=1500:width_type=o:width=1:g=3.2',
    'highshelf=f=8000:g=-3.0',
].join(',');

/**
 * Validates that a file path is safe and points to an existing file
 * Prevents shell injection attacks
 */
function validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        return false;
    }

    // Check for shell command injection patterns
    const dangerousPatterns = [
        '(',
        ')',
        ';',
        '|',
        '&',
        '$',
        '`',
        '<',
        '>',
        '\n',
        '\r',
        'wget',
        'curl',
        'chmod',
        'busybox'
    ];

    for (const pattern of dangerousPatterns) {
        if (filePath.includes(pattern)) {
            return false;
        }
    }

    // Validate filename format (alphanumeric, underscore, hyphen, dot only)
    const basename = path.basename(filePath);
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(basename)) {
        return false;
    }

    // Check file exists
    if (!fs.existsSync(filePath)) {
        return false;
    }

    // Check it's a regular file (not a device, socket, etc.)
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
        return false;
    }

    return true;
}

export async function convertToMp3Audio(inputBuffer, noisePath = null, noiseVolume = "1.35") {
    return new Promise((resolve, reject) => {
        // SECURITY: Validate noiseVolume is a safe numeric value
        const volumeFloat = parseFloat(noiseVolume);
        if (isNaN(volumeFloat) || volumeFloat < 0 || volumeFloat > 10) {
            noiseVolume = "1.35";
        }

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

        let command = ffmpeg()
            .input(inputStream)
            .inputFormat('mp3');

        if (noisePath) {
            if (!validateFilePath(noisePath)) {
                command.audioFilters(EQ_SETTINGS);
            } else {
                command
                    .input(noisePath)
                    .inputOptions(['-stream_loop -1'])
                    .complexFilter([
                        `[0:a]${EQ_SETTINGS}[voice_eq]`,
                        `[1:a]aformat=channel_layouts=mono,volume=${noiseVolume}[noise_low]`,
                        `[voice_eq][noise_low]amix=inputs=2:duration=first:dropout_transition=2[out]`
                    ])
                    .map('[out]');
            }
        } else {
            command.audioFilters(EQ_SETTINGS);
        }

        command
            .audioCodec('libmp3lame')
            .format('mp3')
            .outputOptions([
                '-ac 1',
                '-ar 24000',
                '-b:a 64k'
            ])
            .on('error', (err) => reject(err))
            .pipe(outputStream, { end: true });
    });
}

export async function convertToTelegramVoice(inputBuffer, noisePath = null, noiseVolume = "1.35") {
    return new Promise((resolve, reject) => {
        // SECURITY: Validate noiseVolume is a safe numeric value
        const volumeFloat = parseFloat(noiseVolume);
        if (isNaN(volumeFloat) || volumeFloat < 0 || volumeFloat > 10) {
            noiseVolume = "1.35";
        }

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


        let command = ffmpeg()
            .input(inputStream)
            .inputFormat('mp3');

        if (noisePath) {
            if (!validateFilePath(noisePath)) {
                command.audioFilters(EQ_SETTINGS);
            } else {


                command
                    .input(noisePath)
                    .inputOptions(['-stream_loop -1'])
                    .complexFilter([

                        `[0:a]${EQ_SETTINGS}[voice_eq]`,
                        `[1:a]aformat=channel_layouts=mono,volume=${noiseVolume}[noise_low]`,
                        `[voice_eq][noise_low]amix=inputs=2:duration=first:dropout_transition=2[out]`
                    ])
                    .map('[out]');
            }
        } else {

            command.audioFilters(EQ_SETTINGS);
        }

        command
            .audioCodec('libopus')
            .format('ogg')
            .outputOptions([
                '-ac 1',
                '-ar 24000',
                '-b:a 64k'
            ])
            .on('error', (err) => reject(err))
            .pipe(outputStream, { end: true });
    });
}