import { Telegraf } from 'telegraf';
import axios from 'axios';

const bot = new Telegraf(process.env.BOT_TOKEN);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB'; // Adam

// === КЭШ: username (без @) → chat_id (всё в памяти, живёт пока контейнер жив) ===
const usernameToChatId = new Map(); // "snnikl" → 124825623

// Автоматически сохраняем всех, кто нам пишет (и в ЛС, и в группах)
bot.use((ctx, next) => {
    if (ctx.from?.username) {
        usernameToChatId.set(ctx.from.username.toLowerCase(), ctx.chat.id);
        console.log(`[CACHE] Запомнил @${ctx.from.username} → chat_id ${ctx.chat.id}`);
    }
    return next();
});

// === ElevenLabs TTS ===
async function textToSpeech(text) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`;

    console.log(`[TTS] Озвучиваю: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

    try {
        const response = await axios({
            method: 'POST',
            url,
            data: {
                text,
                model_id: 'eleven_flash_v2_5',
                voice_settings: { stability: 0.5, similarity_boost: 0.9 }
            },
            headers: {
                'Accept': 'audio/ogg',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer',
            timeout: 45000
        });

        console.log(`[TTS] Готово, ${response.data.byteLength} байт`);
        return response.data;
    } catch (error) {
        console.error('[TTS] Ошибка:', error.response?.status, error.response?.data || error.message);
        return null;
    }
}

// === Основная логика ===
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    const fromUser = ctx.from;
    const username = fromUser.username ? `@${fromUser.username}` : fromUser.first_name;

    console.log(`[MSG] ${username} (${fromUser.id}): ${text}`);

    // Проверяем, есть ли @username в начале
    const forwardMatch = text.match(/^@([A-Za-z0-9_]{5,32})\s+(.+)/i);
    const isForward = forwardMatch !== null;

    let targetUsernameLower = null;
    let textToSpeak = text;

    if (isForward) {
        targetUsernameLower = forwardMatch[1].toLowerCase();
        textToSpeak = forwardMatch[2];

        if (textToSpeak.length === 0) {
            return ctx.reply('После @username напиши текст');
        }
    }

    if (textToSpeak.length > 2500) {
        return ctx.reply('Текст слишком длинный (макс ~2500 символов)');
    }

    await ctx.sendChatAction('record_voice');

    const audioBuffer = await textToSpeech(textToSpeak);
    if (!audioBuffer) {
        return ctx.reply('Не смог озвучить 😔 Попробуй позже');
    }

    try {
        if (isForward) {
            const targetChatId = usernameToChatId.get(targetUsernameLower);

            await ctx.telegram.sendVoice(targetChatId, {
                source: audioBuffer,
                filename: 'voice.ogg'
            });

            await ctx.reply(`Голосовое отправлено @${forwardMatch[1]} ✅`);
            console.log(`[FORWARD] ${username} → @${forwardMatch[1]} (${targetChatId})`);
        } else {
            // Обычная отправка себе — чистое голосовое без подписи
            await ctx.sendVoice({
                source: audioBuffer,
                filename: 'voice.ogg'
            });
        }
    } catch (sendError) {
        console.error('[SEND] Ошибка отправки:', sendError.message);
        ctx.reply('Не смог отправить голосовое (возможно, меня заблокировали)');
    }
});

// На всё остальное
bot.on('message', (ctx) => {
    ctx.reply('Привет! Пиши текст — я озвучу.\nИли @username текст — отправлю ему голосовуху');
});

// === Webhook API ===
export async function GET() {
    return new Response('Exomind Voice Proxy — OK', { status: 200 });
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
    console.log('Bot запущен в polling-режиме (dev)');
}