import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGO_URL;

if (!MONGODB_URI) {
    throw new Error('MONGO_URL not defined in environment variables');
}


let cached = global.mongoose;

if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
    if (cached.conn) {
        return cached.conn;
    }

    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI, {
           bufferCommands: false,
        }).then((mongooseInstance) => mongooseInstance);
    }

    cached.conn = await cached.promise;
    return cached.conn;
}

export default dbConnect;
