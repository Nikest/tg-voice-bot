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
1. Исправить грамматические ошибки в тексте.
3. Добавить невербальные элементы в скобках, ГДЕ ЭТО УМЕСТНО по смыслу (но не перебарщивай). Используй такие маркеры: (дишит), (смеется), (кашляет), (ммм). Пиши их на русском в скобках.
5. НЕ меняй слова сообщения.
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