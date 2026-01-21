import { generateVoiceForAPI } from '../bot/route.js';

const TEXT_KEY_API = '46uyw56w4j46HYY4a4';

export async function POST(request) {
    try {
        const body = await request.json();
        const { apiKey, text, voiceID } = body;

        console.log('[POST /generate-voice] Request received:', {
            hasApiKey: !!apiKey,
            textLength: text?.length,
            voiceID
        });

        if (!apiKey || !text || !voiceID) {
            console.log('[POST /generate-voice] Missing required fields');
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
            console.log('[POST /generate-voice] Invalid API key provided');
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
            console.error('[POST /generate-voice] Generation failed:', result);
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

        console.log('[POST /generate-voice] Success! Returning audio file');

        return new Response(result.audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/ogg',
                'Content-Disposition': 'attachment; filename="voice.ogg"'
            }
        });

    } catch (error) {
        console.error('[POST /generate-voice] Unexpected error:', error);
        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                details: error.message,
                stack: error.stack
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}
