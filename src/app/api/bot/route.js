import { Telegraf } from 'telegraf';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/mongoose';
import VoiceSettings from '@/models/VoiceSettings';
import NoiseSettings from "@/models/NoiseSettings";
import { convertToTelegramVoice, convertToMp3Audio } from '@/lib/audioConverter';
import { findUser, createUser, updateVoice, updateNoiseTag } from '@/lib/userService';
import { enhanceTextWithGPT } from '@/lib/gptService';

const bot = new Telegraf(process.env.BOT_TOKEN);

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';

async function findOrCreateUser(telegramUserId) {
    const userId = String(telegramUserId);

    let user = await findUser(userId);

    if (!user) {
        user = await createUser({
            user: userId,
            selectedVoice: VOICE_ID,
            selectedNoiseTag: ''
        });
    }

    return user;
}

async function getValidRandomNoisePath(tag) {
    if (!tag) return null;

    await dbConnect();

    // 1. Ищем все записи с этим тегом
    const candidates = await NoiseSettings.find({ tags: tag });

    if (!candidates || candidates.length === 0) {
        return null;
    }

    const validEntries = [];

    // 2. Проверяем физическое существование файлов
    for (const noise of candidates) {
        const fullPath = path.join(process.cwd(), 'public', 'voices', noise.fileName);

        if (fs.existsSync(fullPath)) {
            validEntries.push({
                path: fullPath,
                volume: noise.volume || "1.35"
            });
        } else {
            await NoiseSettings.deleteOne({ _id: noise._id });
        }
    }

    if (validEntries.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * validEntries.length);
    const selected = validEntries[randomIndex];

    return selected;
}

async function getAllVoices() {
    await dbConnect();

    return VoiceSettings.find({
        exampleFileName: { $ne: '' },
    }).lean();
}

async function findVoiceByName(name) {
    await dbConnect();

    const regex = new RegExp(`^${name.trim()}$`, 'i');

    return VoiceSettings.findOne({ voiceName: regex }).lean();
}

async function textToSpeech(text, voiceId) {
    const finalVoiceId = voiceId || VOICE_ID;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}/stream`;

    try {
        const response = await axios({
            method: 'POST',
            url,
            data: {
                text,
                model_id: 'eleven_v3',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.9,
                    style: 0.0,
                    use_speaker_boost: true,
                },
            },
            headers: {
                'Accept': 'audio/mpeg',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer',
            timeout: 45000
        });

        return response.data;

    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data ? Buffer.from(error.response.data).toString('utf-8').slice(0, 500) : 'no body';



            if (status === 401) return { error: 'Неверный API-ключ ElevenLabs' };
            if (status === 403) return { error: 'Нет доступа к этому голосу (missing_permissions)' };
            if (status === 429) return { error: 'Лимит ElevenLabs превышен' };
            if (status === 422) return { error: 'Текст слишком длинный или содержит запрещённые символы' };
        } else {

            return { error: 'Не смог связаться с ElevenLabs' };
        }
        return { error: 'Неизвестная ошибка ElevenLabs' };
    }
}

async function speechToText(audioBuffer) {

    const formData = new FormData();
    formData.append('model_id', 'scribe_v1');
    formData.append('file', Buffer.from(audioBuffer), {
        filename: 'voice.ogg',
        contentType: 'audio/ogg'
    });

    try {
        const res = await axios.post(
            'https://api.elevenlabs.io/v1/speech-to-text',
            formData,
            {
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    ...formData.getHeaders()
                },
                timeout: 60000
            }
        );

        const text = res.data.text?.trim();
        if (!text || text.length === 0) {
            return { error: 'Не смог разобрать речь — тишина или шум' };
        }

        return { text };

    } catch (err) {
        if (err.response) {
            console.error('[STT] ElevenLabs вернул ошибку:', err.response.status, err.response.data);
        } else {
            console.error('[STT] Сетевая ошибка:', err.message);
        }
        return { error: 'Ошибка распознавания речи' };
    }
}

async function convertAndSend(text, user, ctx) {
    const voiceId = user.selectedVoice || VOICE_ID;
    const rawAudio = await textToSpeech(text, voiceId);
    if (rawAudio.error) return ctx.reply(rawAudio.error);

    try {
        const noiseData = await getValidRandomNoisePath(user.selectedNoiseTag);
        let noisePath = null;
        let noiseVolume = '1.35';

        if (noiseData) {
            noisePath = noiseData.path;
            noiseVolume = noiseData.volume || '1.35';
        }

        const perfectVoiceBuffer = await convertToTelegramVoice(rawAudio, noisePath, noiseVolume);
        console.log('[CONVERT] Конвертация успешна. Шум:', noisePath ? 'ДА' : 'НЕТ', 'Размер буфера:', perfectVoiceBuffer.length);

        try {
            await ctx.sendVoice({
                source: perfectVoiceBuffer,
                filename: 'voice.ogg'
            });
            console.log('[SEND] Голосовое отправлено успешно');
        } catch (voiceErr) {
            const errorMessage = voiceErr.description || voiceErr.message || String(voiceErr);
            console.log('[SEND] Ошибка sendVoice:', errorMessage);

            if (errorMessage.includes('VOICE_MESSAGES_FORBIDDEN')) {
                console.log('[SEND] Обнаружен VOICE_MESSAGES_FORBIDDEN, конвертирую в MP3 с шумом');
                // Telegram блокирует OGG при запрете на голосовые, конвертируем в MP3
                const mp3Buffer = await convertToMp3Audio(rawAudio, noisePath, noiseVolume);
                console.log('[SEND] MP3 конвертация успешна. Размер:', mp3Buffer.length);
                await ctx.sendAudio({
                    source: mp3Buffer,
                    filename: 'audio.mp3'
                }, {
                    caption: '🔊 Аудио-файл (у вас отключены голосовые сообщения)'
                });
                console.log('[SEND] MP3 аудио отправлено успешно');
            } else {
                throw voiceErr;
            }
        }

    } catch (err) {
        console.error('[FALLBACK] Ошибка конвертации:', err.message || err);
        console.log('[FALLBACK] Попытка отправить rawAudio (без обработки)');
        try {
            await ctx.sendVoice({ source: rawAudio, filename: 'voice.ogg' });
            console.log('[FALLBACK] RawAudio отправлен как голосовое');
        } catch (fallbackErr) {
            const errorMessage = fallbackErr.description || fallbackErr.message || String(fallbackErr);
            console.log('[FALLBACK] Ошибка sendVoice:', errorMessage);

            if (errorMessage.includes('VOICE_MESSAGES_FORBIDDEN')) {
                console.log('[FALLBACK] Отправляю rawAudio как аудио');
                await ctx.sendAudio({
                    source: rawAudio,
                    filename: 'audio.mp3'
                }, {
                    caption: '🔊 Аудио-файл (у вас отключены голосовые сообщения)'
                });
                console.log('[FALLBACK] RawAudio отправлен как аудио');
            } else {
                throw fallbackErr;
            }
        }
    }
}

bot.catch((err, ctx) => {
    console.log(`Ой, ошибка в обновлении ${ctx.updateType}`, err);
});

bot.start(async (ctx) => {
    const escapeHTML = (str) => str.replace(
        /[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    );

    const rawName = ctx.from.first_name || 'Гость';
    const userName = escapeHTML(rawName);

    const message = `
👋 <b>Привет, ${userName}!</b>

Я — голосовой бот. Напиши мне текст или запиши голосовое сообщение, и я переозвучу его другим голосом.

Я умею создавать голосовые сообщения с эмоциональной интонацией и добавлять фоновый шум.

🔹 <b>При записи голосового сообщения</b> используйте невербальные звуки (придыхание, смех, покашливание) для лучшей интонации.
🔹 <b>При отправке текста для озвучивания</b> пишите невербальные и эмоциональные интонации в скобках, например: Привет! (смеётся) Как дела? (кашляет).
🔹 <b>Используйте МЕНЮ</b>, чтобы сменить голос и шум.
    `;

    await ctx.reply(message, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true }
    });
});

bot.command('showallvoices', async (ctx) => {
    try {
        const voices = await getAllVoices();

        if (!voices || voices.length === 0) {
            return ctx.reply('Нет сохранённых примеров голосов.');
        }

        await ctx.reply(`Отправляю примеры голосов...`);

        for (const v of voices) {
            if (!v.exampleFileName) {
                continue;
            }

            const filePath = path.join(process.cwd(), 'public', 'voices', v.exampleFileName);

            if (!fs.existsSync(filePath)) {
                await ctx.reply(`Файл для голоса "${v.voiceName}" не найден.`);
                continue;
            }

            await ctx.sendChatAction('upload_voice');

            try {
                await ctx.sendVoice(
                    { source: fs.createReadStream(filePath) },
                    { caption: v.voiceName }
                );
            } catch (voiceErr) {
                const errorMessage = voiceErr.description || voiceErr.message || String(voiceErr);

                if (errorMessage.includes('VOICE_MESSAGES_FORBIDDEN')) {
                    await ctx.sendAudio(
                        { source: fs.createReadStream(filePath) },
                        { caption: `🔊 ${v.voiceName} (аудио-файл)` }
                    );
                } else {
                    throw voiceErr;
                }
            }
        }
    } catch (err) {
        console.error('[CMD /showallvoices] Error:', err);
        ctx.reply('Ошибка при получении списка голосов');
    }
});

bot.command('showallnoises', async (ctx) => {
    try {
        await dbConnect();

        const noises = await NoiseSettings.find().lean();

        if (!noises || noises.length === 0) {
            return ctx.reply('Нет сохранённых шумов.');
        }

        const tagsSet = new Set();
        noises.forEach(n => {
            n.tags.forEach(tag => tagsSet.add(tag));
        });

        const tagsList = Array.from(tagsSet);
        if (tagsList.length === 0) {
            return ctx.reply('Нет сохранённых тегов для шумов.');
        }

        return ctx.reply(`Доступные теги шумов:\n• ${tagsList.join('\n• ')}`);
    } catch (err) {
        console.error('[CMD /showallnoises] Error:', err);
        ctx.reply('Ошибка при получении списка шумов');
    }
});

bot.command('changevoice', async (ctx) => {
    const telegramUserId = ctx.from.id;
    const fullText = ctx.message.text || '';

    const parts = fullText.split(' ');
    const args = parts.slice(1).join(' ').trim();

    if (!args) {
        return ctx.reply('Использование: /changevoice ИмяГолоса\nНапример: /changevoice Анжелика');
    }

    const requestedName = args;

    try {
        const voice = await findVoiceByName(requestedName);

        if (!voice) {
            const allVoices = await VoiceSettings.find().lean();
            if (!allVoices.length) {
                return ctx.reply(`Голос "${requestedName}" не найден в базе.`);
            }

            const list = allVoices.map(v => `• ${v.voiceName}`).join('\n');
            return ctx.reply(
                `Голос "${requestedName}" не найден.\nДоступные голоса:\n${list}`
            );
        }

        await findOrCreateUser(telegramUserId);

        await updateVoice(String(telegramUserId), voice.voiceId);

        return ctx.reply(`Голос изменён на "${voice.voiceName}".`);
    } catch (err) {
        console.error('[CMD /changevoice] Error:', err);
        return ctx.reply('Ошибка при смене голоса.');
    }
});

bot.command('changenoise', async (ctx) => {
    const telegramUserId = ctx.from.id;
    const fullText = ctx.message.text || '';

    const args = fullText.split(' ').slice(1).join(' ').trim().toLowerCase();

    if (!args) {
        return ctx.reply(
            'Использование: /changenoise тег\n' +
            'Например: /changenoise rain\n' +
            'Чтобы выключить шум: /changenoise off'
        );
    }

    const requestedTag = args;

    if (requestedTag === 'off' || requestedTag === 'none' || requestedTag === 'нет') {
        await findOrCreateUser(telegramUserId);
        await updateNoiseTag(String(telegramUserId), '');
        return ctx.reply('Фоновый шум выключен.');
    }

    try {
        await dbConnect();

        const noise = await NoiseSettings.findOne({ tags: requestedTag }).lean();

        if (!noise) {
            const allNoises = await NoiseSettings.find().lean();
            const tagsSet = new Set();
            allNoises.forEach(n => {
                n.tags.forEach(t => tagsSet.add(t));
            });
            const list = Array.from(tagsSet).join(', ');

            return ctx.reply(
                `Шум с тегом "${requestedTag}" не найден.\n` +
                (list ? `Доступные теги:\n${list}` : 'Тегов пока нет.')
            );
        }

        await findOrCreateUser(telegramUserId);
        await updateNoiseTag(String(telegramUserId), requestedTag);

        return ctx.reply(`Фоновый шум установлен: "${requestedTag}".`);
    } catch (err) {
        console.error('[CMD /changenoise] Error:', err);
        return ctx.reply('Ошибка при смене шума.');
    }
});

bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text) return;
    if (text.startsWith('/')) return;

    const telegramUserId = ctx.from.id;
    const user = await findOrCreateUser(telegramUserId);

    await ctx.sendChatAction('record_voice');

    //const processedText = await enhanceTextWithGPT(text);

    await convertAndSend(text, user, ctx);
});


bot.on('voice', async (ctx) => {
    const telegramUserId = ctx.from.id;

    const user = await findOrCreateUser(telegramUserId);

    try {
        const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
        const audioRes = await axios.get(fileLink.href, { responseType: 'arraybuffer' });

        const stt = await speechToText(audioRes.data);

        if (stt.error) return ctx.reply(stt.error);

        await ctx.sendChatAction('record_voice');

        await convertAndSend(stt.text, user, ctx);

    } catch (err) {
        console.error('[VOICE] Fatal error:', err);
        ctx.reply('Ошибка обработки голосового');
    }
});


bot.on('message', (ctx) => {
    ctx.reply('Пиши текст — я озвучу его голосом');
});


// Next.js API Route
export async function GET() {
    return new Response('ExomindV Voice Bot — alive & ready 🤖', { status: 200 });
}

export async function POST(request) {
    try {
        const body = await request.json();
        await bot.handleUpdate(body);
        return new Response('OK', { status: 200 });
    } catch (error) {
        return new Response('Error', { status: 500 });
    }
}


if (process.env.NODE_ENV !== 'production') {
    bot.launch();
}