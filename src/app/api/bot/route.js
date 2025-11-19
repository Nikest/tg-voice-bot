import { Telegraf } from 'telegraf';
import axios from 'axios';

const bot = new Telegraf(process.env.BOT_TOKEN);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam по умолчанию

// === ElevenLabs TTS с подробными логами ===
async function textToSpeech(text) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;

    console.log(`[TTS] Запрос на озвучку: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

    try {
        const response = await axios({
            method: 'POST',
            url,
            data: {
                text,
                model_id: 'eleven_flash_v2_5', // именно та, что у тебя работает
                voice_settings: {
                    stability: 0.5,      // как у тебя на скрине
                    similarity_boost: 0.9,
                    style: 0.0,
                    use_speaker_boost: true
                }
            },
            headers: {
                'Accept': 'audio/ogg',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer',
            timeout: 45000 // увеличил — иногда Flash думает подольше
        });

        console.log(`[TTS] Успешно получено аудио: ${response.data.byteLength} байт`);
        return response.data;

    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data ? Buffer.from(error.response.data).toString('utf-8').slice(0, 500) : 'no body';
            console.error(`[TTS] ElevenLabs ошибка ${status}: ${data}`);

            // Специальные сообщения для частых ошибок
            if (status === 401) return { error: 'Неверный API-ключ ElevenLabs' };
            if (status === 403) return { error: 'Нет доступа к этому голосу (missing_permissions)' };
            if (status === 429) return { error: 'Лимит ElevenLabs превышен' };
            if (status === 422) return { error: 'Текст слишком длинный или содержит запрещённые символы' };
        } else {
            console.error('[TTS] Ошибка сети или таймаут:', error.message);
            return { error: 'Не смог связаться с ElevenLabs' };
        }
        return { error: 'Неизвестная ошибка ElevenLabs' };
    }
}

// === Основная логика бота ===
bot.on('text', async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();

    console.log(`[MSG] Пользователь ${userId} (${ctx.from.first_name}) написал: "${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"`);

    if (!text) return;

    if (text.length > 2500) {
        return ctx.reply('Текст слишком длинный, максимум ~2500 символов');
    }

    await ctx.sendChatAction('record_voice');

    const result = await textToSpeech(text);

    // Если TTS вернул ошибку
    if (result.error) {
        console.error(`[BOT] Не удалось озвучить для ${userId}: ${result.error}`);
        return ctx.reply(`Не смог озвучить 😔\n${result.error}\nПопробуй позже или короче текст.`);
    }

    try {
        await ctx.sendVoice(
            { source: result, filename: 'voice.ogg' },
            { caption: text.length <= 60 ? text : undefined }
        );
        console.log(`[BOT] Голосовуха успешно отправлена пользователю ${userId}`);
    } catch (sendError) {
        console.error('[BOT] Ошибка отправки voice в Telegram:', sendError.message);
        ctx.reply('Озвучил, но не смог отправить файл 😱');
    }
});

// На всё остальное (голосовухи, фото и т.д.)
bot.on('message', (ctx) => {
    console.log(`[MSG] Неподдерживаемый тип сообщения от ${ctx.from.id}: ${ctx.message?.caption || ctx.message?.voice ? 'voice/file' : 'другое'}`);
    ctx.reply('Пиши текст — я озвучу его голосом Adam (ElevenLabs Flash v2.5) ✨');
});

// ====================== Next.js API Route ======================
export async function GET() {
    console.log('[HEALTH] GET /api/bot — бот жив');
    return new Response('ExomindV Voice Bot — alive & ready 🤖', { status: 200 });
}

export async function POST(request) {
    try {
        const body = await request.json();
        await bot.handleUpdate(body);
        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('[WEBHOOK] Критическая ошибка:', error);
        return new Response('Error', { status: 500 });
    }
}

// Dev polling
if (process.env.NODE_ENV !== 'production') {
    bot.launch();
    console.log('Bot running in polling mode (dev)');
}