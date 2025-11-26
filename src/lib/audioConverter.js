import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

// В Docker (Alpine Linux) ffmpeg обычно лежит здесь.
// Явное указание пути часто решает проблему "spawn ENOENT" или зависаний.
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

// --- НАСТРОЙКИ ЭКВАЛАЙЗЕРА ---
// Мы используем цепочку фильтров.
// 1. lowshelf: Бас (+12.7dB на 90Hz)
// 2. equalizer: Середина (+5.9dB на 1.5kHz). width_type=o:width=1 означает ширину в 1 октаву.
// 3. highshelf: Верха (-8.2dB на 8kHz)
// 4. alimiter: Лимитер, чтобы не было хрипа (клиппинга) после усиления баса
const EQ_FILTER_CHAIN = [
    'lowshelf=f=90:g=12.7',
    'equalizer=f=1500:width_type=o:width=1:g=5.9',
    'highshelf=f=8000:g=-8.2',
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
            .inputFormat('ogg')
            // === ВАЖНО: ЛОГИРОВАНИЕ ОШИБОК САМОГО FFMPEG ===
            .on('stderr', (stderrLine) => {
                // Это покажет реальную причину падения в консоли докера
                console.log('[FFmpeg Log]:', stderrLine);
            })
            // ===============================================
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