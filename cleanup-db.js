const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const NoiseSettings = require('./src/models/NoiseSettings').default;

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Connected to MongoDB');

        // Найти все записи с подозрительными fileName
        const allNoises = await NoiseSettings.find({});

        console.log(`\nTotal noise records: ${allNoises.length}\n`);

        const malicious = [];
        const valid = [];

        for (const noise of allNoises) {
            const fileName = noise.fileName || '';

            // Проверяем на shell-команды
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
                console.log(`❌ MALICIOUS: ${noise._id}`);
                console.log(`   fileName: ${fileName.substring(0, 100)}...`);
            } else {
                valid.push(noise);
                console.log(`✅ Valid: ${noise.fileName}`);
            }
        }

        console.log(`\n\nSummary:`);
        console.log(`Valid records: ${valid.length}`);
        console.log(`Malicious records: ${malicious.length}`);

        if (malicious.length > 0) {
            console.log('\n⚠️  Deleting malicious records...');

            for (const mal of malicious) {
                await NoiseSettings.deleteOne({ _id: mal._id });
                console.log(`Deleted: ${mal._id}`);
            }

            console.log('\n✅ Cleanup complete!');
        } else {
            console.log('\n✅ No malicious records found!');
        }

        await mongoose.disconnect();

    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

cleanup();
