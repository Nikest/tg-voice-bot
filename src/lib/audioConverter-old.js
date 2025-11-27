import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';


ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

const EQ_FILTER_CHAIN = [
    'lowshelf=f=90:g=3.5',
    'equalizer=f=1500:width_type=o:width=1:g=3.2',
    'highshelf=f=8000:g=-3.0',
    'alimiter=level_in=1:level_out=0.95:limit=0.95:attack=5:release=50'
].join(',');

export async function convertToTelegramVoice(inputBuffer) {
    return new Promise((resolve, reject) => {
        const outputStream = new PassThrough();
        const inputStream = new PassThrough();

        // Важно: Сначала вешаем обработчики ошибок на потоки
        inputStream.on('error', (err) => console.error('[Stream] Input Error:', err));
        outputStream.on('error', (err) => console.error('[Stream] Output Error:', err));

        // Заливаем данные
        inputStream.end(inputBuffer);

        const chunks = [];

        outputStream.on('data', (chunk) => chunks.push(chunk));
        outputStream.on('end', () => {
            const resultBuffer = Buffer.concat(chunks);
            if (resultBuffer.length === 0) {
                // Если буфер пустой, реджектим, чтобы сработал fallback в основном коде
                return reject(new Error('FFmpeg conversion resulted in empty buffer'));
            }
            resolve(resultBuffer);
        });

        ffmpeg(inputStream)
            .inputFormat('mp3')
            .on('stderr', (stderrLine) => {
                console.log('[FFmpeg Log]:', stderrLine);
            })
            .audioFilters(EQ_FILTER_CHAIN)
            .audioCodec('libopus')
            .format('ogg')
            .outputOptions([
                '-ac 1',       // Моно
                '-ar 24000',   // 24kHz (стандарт для voice)
                '-b:a 24k',    // Битрейт для голоса
                '-application voip'
            ])
            .on('error', (err) => {
                // Основная ошибка процесса
                // console.error мы убираем, так как stderr выше даст больше инфы
                reject(err);
            })
            .pipe(outputStream, { end: true });
    });
}