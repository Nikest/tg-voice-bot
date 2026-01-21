import { generateVoiceForAPI } from '../bot/route.js';

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

        const result = await generateVoiceForAPI(text, voiceID);

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
