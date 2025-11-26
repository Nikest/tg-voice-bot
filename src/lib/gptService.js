import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function enhanceTextWithGPT(inputText) {
    if (!inputText || inputText.length < 2) return inputText;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Ты — редактор сценариев для голосового синтеза. Твоя задача:
1. Исправить грамматические и пунктуационные ошибки в тексте.
2. Сделать текст более "разговорным" и живым.
3. Добавить невербальные элементы в скобках, ГДЕ ЭТО УМЕСТНО по смыслу (но не перебарщивай). Используй такие маркеры: (sighs), (laughs), (clears throat), (pause), (whispers). Пиши их на английском в скобках, так синтезатор лучше их понимает как инструкции, а не текст.
4. Если текст очень короткий (1-2 слова), просто исправь ошибки.
5. НЕ меняй смысл сообщения.
6. Верни ТОЛЬКО обработанный текст, без вступлений.`
                },
                {
                    role: "user",
                    content: inputText
                }
            ],
            temperature: 0.75,
            max_tokens: 500,
        });

        const enhancedText = completion.choices[0].message.content;
        console.log(`[GPT] Original: "${inputText}" -> Enhanced: "${enhancedText}"`);
        return enhancedText;

    } catch (error) {
        console.error('[GPT] Error processing text:', error);
        return inputText;
    }
}