import { NextResponse } from 'next/server';
import path from 'path';
import { promises as fs } from 'fs';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

// Upload image to HeyGen and get talking_photo_id
async function uploadTalkingPhoto(imageBuffer, contentType) {
    const response = await fetch('https://upload.heygen.com/v1/talking_photo', {
        method: 'POST',
        headers: {
            'X-Api-Key': HEYGEN_API_KEY,
            'Content-Type': contentType,
        },
        body: imageBuffer,
    });

    const data = await response.json();

    if (data.code !== 100 || !data.data?.talking_photo_id) {
        throw new Error(data.message || 'Failed to upload talking photo');
    }

    return data.data.talking_photo_id;
}

// Get list of available voices
async function getVoices() {
    const response = await fetch('https://api.heygen.com/v2/voices', {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-Api-Key': HEYGEN_API_KEY,
        },
    });

    const data = await response.json();
    return data.data?.voices || [];
}

// Create video with talking photo
async function createVideo(talkingPhotoId, text, voiceId) {
    const response = await fetch('https://api.heygen.com/v2/video/generate', {
        method: 'POST',
        headers: {
            'X-Api-Key': HEYGEN_API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            video_inputs: [
                {
                    character: {
                        type: 'talking_photo',
                        talking_photo_id: talkingPhotoId,
                    },
                    voice: {
                        type: 'text',
                        voice_id: voiceId,
                        input_text: text,
                        speed: 1.0,
                    },
                    background: {
                        type: 'color',
                        value: '#FFFFFF',
                    },
                },
            ],
            dimension: {
                width: 1080,
                height: 1920,
            },
        }),
    });

    const data = await response.json();

    if (data.error || !data.data?.video_id) {
        throw new Error(data.error?.message || 'Failed to create video');
    }

    return data.data.video_id;
}

// Check video status
async function getVideoStatus(videoId) {
    const response = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${videoId}`,
        {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'X-Api-Key': HEYGEN_API_KEY,
            },
        }
    );

    const data = await response.json();
    return data.data;
}

// GET - check video status or get voices list
export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const videoId = searchParams.get('video_id');
        const action = searchParams.get('action');

        if (action === 'voices') {
            const voices = await getVoices();
            return NextResponse.json({ voices });
        }

        if (videoId) {
            const status = await getVideoStatus(videoId);

            // If completed, download and save video locally
            if (status.status === 'completed' && status.video_url) {
                const videoDir = path.join(process.cwd(), 'public', 'videos');
                await fs.mkdir(videoDir, { recursive: true });

                const fileName = `heygen_${videoId}.mp4`;
                const filePath = path.join(videoDir, fileName);

                // Check if file already exists
                try {
                    await fs.access(filePath);
                } catch {
                    // File doesn't exist, download it
                    const videoResponse = await fetch(status.video_url);
                    const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
                    await fs.writeFile(filePath, videoBuffer);
                }

                return NextResponse.json({
                    status: status.status,
                    video_url: status.video_url,
                    local_url: `/videos/${fileName}`,
                    thumbnail_url: status.thumbnail_url,
                });
            }

            return NextResponse.json({
                status: status.status,
                error: status.error,
            });
        }

        return NextResponse.json({ error: 'Missing video_id parameter' }, { status: 400 });
    } catch (err) {
        console.error('[HEYGEN GET] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// POST - upload photo and create video
export async function POST(req) {
    try {
        if (!HEYGEN_API_KEY) {
            return NextResponse.json(
                { error: 'HEYGEN_API_KEY not configured' },
                { status: 500 }
            );
        }

        const formData = await req.formData();
        const photo = formData.get('photo');
        const text = formData.get('text');
        const voiceId = formData.get('voiceId');

        if (!photo || !text || !voiceId) {
            return NextResponse.json(
                { error: 'photo, text, and voiceId are required' },
                { status: 400 }
            );
        }

        // Get image buffer and content type
        const arrayBuffer = await photo.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);
        const contentType = photo.type || 'image/jpeg';

        // Upload talking photo
        const talkingPhotoId = await uploadTalkingPhoto(imageBuffer, contentType);

        // Create video
        const videoId = await createVideo(talkingPhotoId, text, voiceId);

        return NextResponse.json({
            success: true,
            video_id: videoId,
            talking_photo_id: talkingPhotoId,
        });
    } catch (err) {
        console.error('[HEYGEN POST] Error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
