import mongoose from 'mongoose';

const NoiseSettingsSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        fileName: {
            type: String,
            required: true,
        },
        tags: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true }
);

export default mongoose.models.NoiseSettings || mongoose.model('NoiseSettings', NoiseSettingsSchema);