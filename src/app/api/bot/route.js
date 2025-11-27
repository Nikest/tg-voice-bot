import { Telegraf } from 'telegraf';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import dbConnect from '@/lib/mongoose';
import VoiceSettings from '@/models/VoiceSettings';
import NoiseSettings from "@/models/NoiseSettings";
import { convertToTelegramVoice } from '@/lib/audioConverter';
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
                'Accept': 'audio/ogg',
                'xi-api-key': ELEVENLABS_API_KEY,
                'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer',
            timeout: 45000
        });

        console.log(`[TTS] Успешно получено аудио: ${response.data.byteLength} байт`);
        return response.data;

    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data ? Buffer.from(error.response.data).toString('utf-8').slice(0, 500) : 'no body';
            console.error(`[TTS] ElevenLabs ошибка ${status}: ${data}`);


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

async function speechToText(audioBuffer) {
    console.log(`[STT] Распознаём аудио ${audioBuffer.byteLength} байт`);

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
            console.log('[STT] Пустой результат');
            return { error: 'Не смог разобрать речь — тишина или шум' };
        }

        console.log(`[STT] Распознанный текст: "${text}"`);
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

async function convertAndSend(text, voiceId, ctx) {
    const rawAudio = await textToSpeech(text, voiceId);
    if (rawAudio.error) return ctx.reply(rawAudio.error);

    try {
        const perfectVoiceBuffer = await convertToTelegramVoice(rawAudio);

        await ctx.sendVoice({
            source: perfectVoiceBuffer,
            filename: 'voice.ogg'
        });

    } catch (err) {
        console.error('Ошибка конвертации:', err);
        await ctx.sendVoice({ source: rawAudio, filename: 'voice.ogg' });
    }
}

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
                console.warn(`[VOICES] Файл не найден: ${filePath}`);
                await ctx.reply(`Файл для голоса "${v.voiceName}" не найден.`);
                continue;
            }

            await ctx.sendChatAction('upload_voice');

            await ctx.sendVoice(
                { source: fs.createReadStream(filePath) },
                { caption: v.voiceName }
            );
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
    const voiceId = user?.selectedVoice || VOICE_ID;

    await ctx.sendChatAction('record_voice');

    const processedText = await enhanceTextWithGPT(text);

    await convertAndSend(processedText, voiceId, ctx);
});


bot.on('voice', async (ctx) => {
    const telegramUserId = ctx.from.id;

    const user = await findOrCreateUser(telegramUserId);
    const voiceId = user?.selectedVoice || VOICE_ID;

    try {
        const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
        const audioRes = await axios.get(fileLink.href, { responseType: 'arraybuffer' });

        const stt = await speechToText(audioRes.data);

        if (stt.error) return ctx.reply(stt.error);

        await ctx.sendChatAction('record_voice');

        await convertAndSend(stt.text, voiceId, ctx);

    } catch (err) {
        console.error('[VOICE] Fatal error:', err);
        ctx.reply('Ошибка обработки голосового');
    }
});


bot.on('message', (ctx) => {
    console.log(`[MSG] Неподдерживаемый тип сообщения от ${ctx.from.id}: ${ctx.message?.caption || ctx.message?.voice ? 'voice/file' : 'другое'}`);
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
    console.log('Bot running in polling mode (dev)');
}