import { textToSpeech } from '../bot/route.js';
import { convertToTelegramVoice } from '@/lib/audioConverter';

const TEXT_KEY_API = '46uyw56w4j46HYY4a4';

export async function POST(request) {
    try {
        const body = await request.json();
        const { apiKey, text, voiceID } = body;

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

        const rawAudio = await textToSpeech(text, voiceID);

        if (rawAudio.error) {
            return new Response(
                JSON.stringify({
                    error: rawAudio.error
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        const oggBuffer = await convertToTelegramVoice(rawAudio);

        return new Response(oggBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/ogg',
                'Content-Disposition': 'attachment; filename="voice.ogg"'
            }
        });

    } catch (error) {
        console.error('[API /generate-voice] Error:', error);
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
