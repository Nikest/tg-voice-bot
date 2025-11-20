import dbConnect from './mongoose';
import VoiceSettings from '../models/VoiceSettings';

export async function createVoiceSetting(data) {
    await dbConnect();
    return VoiceSettings.create(data);
}

export async function findVoice(voiceId) {
    await dbConnect();
    return VoiceSettings.findOne({ voiceId });
}

export async function findAllVoices() {
    await dbConnect();
    return VoiceSettings.find().lean();
}

export async function updateVoiceSetting(voiceId, updateData) {
    await dbConnect();
    return VoiceSettings.findOneAndUpdate(
        { voiceId },
        updateData,
        { new: true }
    );
}

export async function deleteVoiceSetting(voiceId) {
    await dbConnect();
    return VoiceSettings.deleteOne({ voiceId });
}
