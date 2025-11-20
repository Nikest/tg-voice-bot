import mongoose from 'mongoose';

const VoiceSettingsSchema = new mongoose.Schema(
    {
        voiceId: {
            type: String,
            required: true,
            unique: true,
        },
        voiceName: {
            type: String,
            required: true,
            unique: true,
        },
        stability: {
            type: Number,
            default: 0.5,
        },
        similarityBoost: {
            type: Number,
            default: 0.9,
        },
        style: {
            type: Number,
            default: 0.0,
        },
        useSpeakerBoost: {
            type: Boolean,
            default: true,
        },
        exampleFileName: {
            type: String,
            default: '',
        },
    },
    { timestamps: true }
);

export default mongoose.models.VoiceSettings || mongoose.model('VoiceSettings', VoiceSettingsSchema);
