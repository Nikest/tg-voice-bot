import { NextResponse } from 'next/server';

import dbConnect from '@/lib/mongoose';
import NoiseSettings from '@/models/NoiseSettings';
import VoiceSettings from '@/models/VoiceSettings';

export async function GET() {
    try {
        await dbConnect();

        const noiseResult = await NoiseSettings.deleteMany({});
        const voiceResult = await VoiceSettings.deleteMany({});

        return NextResponse.json({
            success: true,
            deleted: {
                noiseSettings: noiseResult.deletedCount,
                voiceSettings: voiceResult.deletedCount,
            },
            message: 'All noise and voice settings have been deleted from the database',
        });
    } catch (err) {
        console.error('[DB_CLEANING] Error:', err);
        return NextResponse.json(
            { error: 'Internal error during db_cleaning', details: err.message },
            { status: 500 }
        );
    }
}
