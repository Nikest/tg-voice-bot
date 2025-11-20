import { Telegraf } from 'telegraf';
import axios from 'axios';
import FormData from 'form-data';

import { findUser, createUser } from '../../../lib/userService';

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

async function textToSpeech(text, voiceId) {
    const finalVoiceId = voiceId || VOICE_ID;
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}/stream`;

    try {
        const response = await axios({
            method: 'POST',
            url,
            data: {
                text,
                model_id: 'eleven_flash_v2_5',
                voice_settings: {
                    stability: 0.5,
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

bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text) return;

    const telegramUserId = ctx.from.id;
    const user = await findOrCreateUser(telegramUserId);
    const voiceId = user?.selectedVoice || VOICE_ID;

    await ctx.sendChatAction('record_voice');
    const audio = await textToSpeech(text, voiceId);
    if (audio.error) return ctx.reply(audio.error);

    await ctx.sendVoice({ source: audio, filename: 'voice.ogg' });
});


bot.on('voice', async (ctx) => {
    const telegramUserId = ctx.from.id;
    await ctx.sendChatAction('record_voice');

    const user = await findOrCreateUser(telegramUserId);
    const voiceId = user?.selectedVoice || VOICE_ID;

    try {
        const fileLink = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
        const audioRes = await axios.get(fileLink.href, { responseType: 'arraybuffer' });

        const stt = await speechToText(audioRes.data);
        if (stt.error) return ctx.reply(stt.error);

        const tts = await textToSpeech(stt.text, voiceId);

        if (tts.error) return ctx.reply(tts.error);

        await ctx.sendVoice(
            { source: tts, filename: 'reply.ogg' }
        );
    } catch (err) {
        console.error('[VOICE] Fatal error:', err);
        ctx.reply('Ошибка обработки голосового');
    }
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