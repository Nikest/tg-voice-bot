import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

// Указываем путь для Alpine Linux (Docker)
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

// Мягкие настройки эквалайзера (Natural Radio)
const EQ_SETTINGS = [
    'lowshelf=f=90:g=3.5',
    'equalizer=f=1500:width_type=o:width=1:g=3.2',
    'highshelf=f=8000:g=-3.0',
    'alimiter=level_in=1:level_out=0.95:limit=0.95:attack=5:release=50'
].join(',');

/**
 * Конвертирует аудио буфер в OGG/Opus для Telegram.
 * Опционально накладывает фоновый шум.
 * @param {Buffer} inputBuffer - Аудио голоса
 * @param {string|null} noisePath - Полный путь к файлу шума (или null)
 */
export async function convertToTelegramVoice(inputBuffer, noisePath = null) {
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

        // Создаем команду
        let command = ffmpeg()
            .input(inputStream)
            .inputFormat('mp3'); // ElevenLabs отдает mp3

        // ЛОГИКА ВЕТВЛЕНИЯ: С ШУМОМ ИЛИ БЕЗ
        if (noisePath) {
            console.log(`[FFmpeg] Mixing with noise: ${noisePath}`);

            command
                .input(noisePath)
                .inputOptions(['-stream_loop -1']) // Зацикливаем шум бесконечно
                .complexFilter([
                    // 1. Эквалайзер на голос [0:a] -> [voice_eq]
                    `[0:a]${EQ_SETTINGS}[voice_eq]`,

                    // 2. Обработка шума:
                    // aformat=channel_layouts=mono: Принудительно делаем шум моно, чтобы он корректно лег под голос
                    // volume=0.5: Подняли громкость до 50% (было 0.15, возможно слишком тихо)
                    `[1:a]aformat=channel_layouts=mono,volume=0.75[noise_low]`,

                    // 3. Смешиваем. duration=first обрезает шум по длине голоса.
                    `[voice_eq][noise_low]amix=inputs=2:duration=first:dropout_transition=2[out]`
                ])
                .map('[out]'); // Берем результат микса
        } else {
            console.log('[FFmpeg] Applying EQ only (no noise)');
            // Если шума нет, просто накладываем фильтры на единственный поток
            command.audioFilters(EQ_SETTINGS);
        }

        // Общие настройки выхода
        command
            .on('stderr', (line) => console.log('[FFmpeg Log]:', line))
            .audioCodec('libopus')
            .format('ogg')
            .outputOptions([
                '-ac 1',       // Моно
                '-ar 24000',   // 24kHz
                '-b:a 24k',    // Битрейт
                '-application voip'
            ])
            .on('error', (err) => reject(err))
            .pipe(outputStream, { end: true });
    });
}