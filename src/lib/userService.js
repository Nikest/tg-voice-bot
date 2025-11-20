import dbConnect from './mongoose';
import User from '../models/User';


export async function createUser({ user, selectedVoice = '21m00Tcm4TlvDq8ikWAM', credits = 0 }) {
    await dbConnect();

    let doc = await User.findOne({ user });
    if (doc) return doc;

    doc = await User.create({
        user,
        selectedVoice,
        credits,
    });

    return doc;
}

export async function findUser(user) {
    await dbConnect();
    return User.findOne({ user });
}


export async function updateVoice(user, newVoice) {
    await dbConnect();

    const doc = await User.findOneAndUpdate(
        { user },
        { selectedVoice: newVoice },
        { new: true }
    );

    return doc;
}


export async function updateCredits(user, diffCredits) {
    await dbConnect();

    const doc = await User.findOneAndUpdate(
        { user },
        { $inc: { credits: diffCredits } },
        { new: true }
    );

    return doc;
}
