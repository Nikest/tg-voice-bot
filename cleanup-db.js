const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const NoiseSettings = require('./src/models/NoiseSettings').default;

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Connected to MongoDB');

        const allNoises = await NoiseSettings.find({});


        const malicious = [];
        const valid = [];

        for (const noise of allNoises) {
            const fileName = noise.fileName || '';

            if (fileName.includes('(') ||
                fileName.includes(')') ||
                fileName.includes(';') ||
                fileName.includes('|') ||
                fileName.includes('wget') ||
                fileName.includes('curl') ||
                fileName.includes('busybox') ||
                fileName.includes('sh') ||
                !fileName.match(/^[a-zA-Z0-9_\-\.]+$/)) {

                malicious.push(noise);

            } else {
                valid.push(noise);

            }
        }


        if (malicious.length > 0) {


            for (const mal of malicious) {
                await NoiseSettings.deleteOne({ _id: mal._id });

            }
        } else {

        }

        await mongoose.disconnect();

    } catch (err) {

        process.exit(1);
    }
}

cleanup();
