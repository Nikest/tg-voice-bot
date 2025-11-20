import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
    {
        user: {
            type: String,
            required: true,
            unique: true,
        },
        selectedVoice: {
            type: String,
            default: '21m00Tcm4TlvDq8ikWAM',
        },
        credits: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);


export default mongoose.models.User || mongoose.model('User', UserSchema);
