import { generateVoiceForAPI } from '../bot/route.js';
import OpenAI from 'openai';

const TEXT_KEY_API = '46uyw56w4j46HYY4a4';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
Ты — модуль подготовки текста для озвучки.
Твоя задача — добавлять невербальные элементы в исходный текст, НЕ ИЗМЕНЯЯ сам текст.
Разрешённые невербальные вставки (только в таком виде):
(ммм)
(кхм)
(пауза)
(дышит)
(кашляет)
(смеется)

Строгие правила:
Запрещено:
менять слова, буквы, регистр, пунктуацию исходного текста
исправлять ошибки
перефразировать
добавлять новые слова
удалять любые элементы исходного текста
Разрешено только:
вставлять невербальные элементы между словами, перед первым словом или после последнего слова

Невербальные элементы должны быть:
логически уместны для живой человеческой речи
не слишком частыми (избегай перегрузки)

Формат вывода:
только модифицированный текст
без комментариев, пояснений или мета-описаний

Пример:
Ввод: Привет как дела?
Вывод: (ммм), привет, (пауза) как дела?

Всегда соблюдай эти правила. Нарушение любого пункта недопустимо.
`;

async function processTextWithGPT(text) {
    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4.1-mini',
            messages: [
                {
                    role: 'system',
                    content: SYSTEM_PROMPT
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
        });

        const processedText = completion.choices[0]?.message?.content?.trim();

        if (!processedText) {
            return { error: 'GPT не вернул результат', code: 'GPT_EMPTY_RESPONSE' };
        }

        return { success: true, text: processedText };

    } catch (error) {
        return {
            error: 'Ошибка обработки текста через GPT: ' + error.message,
            code: 'GPT_ERROR',
            details: error.message
        };
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { apiKey, text, voiceID, mode } = body;

        if (!apiKey || !text || !voiceID) {
            return new Response(
                JSON.stringify({
                    error: 'Missing required fields: apiKey, text, voiceID'
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        if (apiKey !== TEXT_KEY_API) {
            return new Response(
                JSON.stringify({
                    error: 'Invalid API key'
                }),
                {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        let inputText = text;

        const modeMap = {
            sad: '[sad] [whispers]',
            serious: '(серьёзно)',
        };

        if (mode && modeMap[mode]) {
            const tag = modeMap[mode];
            inputText = inputText
                .replace(/([.,])\s*/g, `$1 ${tag} `)
                .replace(/^/, `${tag} `);
        }

        const gptResult = await processTextWithGPT(inputText);

        let processedText = inputText;

        if (gptResult.error) {
            processedText = inputText;
            console.log(gptResult);
        } else {
            processedText = gptResult.text;
        }

        const result = await generateVoiceForAPI(processedText, voiceID, { mode });

        if (result.error) {
            return new Response(
                JSON.stringify({
                    error: result.error,
                    code: result.code,
                    details: result.details
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        return new Response(result.audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/ogg',
                'Content-Disposition': 'attachment; filename="voice.ogg"'
            }
        });

    } catch (error) {
        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                details: error.message
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}
