import { Telegraf } from 'telegraf';
import axios from 'axios';

const bot = new Telegraf(process.env.BOT_TOKEN);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

// Функция синтеза речи через ElevenLabs (возвращает Buffer в ogg/opus)
async function textToSpeech(text) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;

    const response = await axios({
        method: 'POST',
        url,
        data: {
            text: text,
            model_id: 'eleven_turbo_v2_5', // самый быстрый и дешёвый на 2025 год
            voice_settings: {
                stability: 0.75,
                similarity_boost: 0.85,
                style: 0.0,
                use_speaker_boost: true
            }
        },
        headers: {
            'Accept': 'audio/ogg',
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer', // важно! получаем бинарник
        timeout: 30000
    });

    return response.data; // Buffer с ogg/opus
}

// Обработка любого текстового сообщения
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();

    // Защита от слишком длинных сообщений (ElevenLabs лимит ~5000 символов, Telegram voice до 45 сек)
    if (text.length === 0) return;
    if (text.length > 2000) {
        return ctx.reply('Слишком длинный текст, максимум ~2000 символов');
    }

    // Отправляем "typing..." чтобы пользователь видел, что бот что-то делает
    await ctx.sendChatAction('record_voice');

    try {
        const audioBuffer = await textToSpeech(text);

        // Отправляем как voice (не как audio/file, именно voice — тогда это голосовуху в Telegram)
        await ctx.sendVoice(
            { source: audioBuffer, filename: 'voice.ogg' },
            { caption: text.length > 50 ? undefined : text } // подпись только если короткий текст
        );

    } catch (error) {
        console.error('ElevenLabs error:', error.response?.data || error.message);
        await ctx.reply('Не смог озвучить 😔 Попробуй позже или короче текст.');
    }
});

// Всё остальное (стикеры, фото и т.д.) можно просто игнорировать или отвечать
bot.on('message', (ctx) => {
    ctx.reply('Пиши текст — я озвучу его голосом!');
});

// ====================== Next.js API Route ======================
export async function GET() {
    return new Response('Bot is alive', { status: 200 });
}

export async function POST(request) {
    try {
        const body = await request.json();
        await bot.handleUpdate(body);
        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('Webhook error:', error);
        return new Response('Error', { status: 500 });
    }
}

// Только для локального dev (polling)
if (process.env.NODE_ENV !== 'production') {
    bot.launch();
    console.log('Bot running in polling mode (dev)');
}