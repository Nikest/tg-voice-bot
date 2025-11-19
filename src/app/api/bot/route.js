import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN);

// Эхо-логика: повторяем любое текстовое сообщение
bot.on('text', (ctx) => {
    ctx.reply(ctx.message.text);
});

// Можно добавить реакцию на стикеры, голосовухи и т.д. (пока просто игнорируем)
bot.on('sticker', (ctx) => ctx.reply('👍'));

// Обработка всех остальных типов сообщений
bot.on('message', (ctx) => {
    ctx.reply('Я пока умею только повторять текст 😅');
});

// Экспортируем обработчики для Next.js API Route
export async function GET(request) {
    return new Response('OK', { status: 200 });
}

export async function POST(request) {
    try {
        const body = await request.json();
        await bot.handleUpdate(body);
        return new Response('OK', { status: 200 });
    } catch (error) {
        console.error('Error handling update:', error);
        return new Response('Error', { status: 500 });
    }
}

// ВАЖНО: для dev-режима запускаем бота (чтобы можно было тестировать локально)
if (process.env.NODE_ENV !== 'production') {
    bot.launch();
    console.log('Bot is running in polling mode (development)');
}