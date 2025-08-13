import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function testDifferentConnections() {
    const baseConnection = process.env.MONGODB_CONNECTION_STRING;

    if (!baseConnection) {
        console.error('❌ MONGODB_CONNECTION_STRING not found in .env');
        return;
    }

    // Clean the connection string
    let cleanConnection = baseConnection.trim();
    if (cleanConnection.startsWith('"') && cleanConnection.endsWith('"')) {
        cleanConnection = cleanConnection.slice(1, -1);
    }

    console.log('🧪 Testing MongoDB Connection Variations\n');
    console.log(`Base connection: ${cleanConnection.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}\n`);

    // Test configurations
    const testConfigs = [
        {
            name: 'Default connection (no database specified)',
            url: cleanConnection,
            options: {}
        },
        {
            name: 'With leequid_database',
            url: cleanConnection.endsWith('/') ? `${cleanConnection}leequid_database` : `${cleanConnection}/leequid_database`,
            options: {}
        },
        {
            name: 'With admin authSource',
            url: cleanConnection.endsWith('/') ? `${cleanConnection}leequid_database` : `${cleanConnection}/leequid_database`,
            options: { authSource: 'admin' }
        },
        {
            name: 'With leequid_database authSource',
            url: cleanConnection.endsWith('/') ? `${cleanConnection}leequid_database` : `${cleanConnection}/leequid_database`,
            options: { authSource: 'leequid_database' }
        },
        {
            name: 'No authSource specified',
            url: cleanConnection.endsWith('/') ? `${cleanConnection}leequid_database` : `${cleanConnection}/leequid_database`,
            options: {
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                bufferCommands: false,
                bufferMaxEntries: 0
            }
        }
    ];

    for (const config of testConfigs) {
        console.log(`🔍 Testing: ${config.name}`);
        console.log(`   URL: ${config.url.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
        console.log(`   Options:`, JSON.stringify(config.options, null, 2));

        try {
            await mongoose.connect(config.url, config.options);
            console.log('   ✅ Connection successful!');

            // Try to list databases
            try {
                const adminDb = mongoose.connection.db.admin();
                const dbList = await adminDb.listDatabases();
                console.log('   📋 Available databases:', dbList.databases.map(db => db.name));

                // Check if leequid_database exists
                const hasLeequidDb = dbList.databases.some(db => db.name === 'leequid_database');
                if (hasLeequidDb) {
                    console.log('   ✅ leequid_database found!');

                    // Try to list collections
                    const collections = await mongoose.connection.db.listCollections().toArray();
                    console.log('   📂 Collections in leequid_database:', collections.map(c => c.name));

                    const hasStableYields = collections.some(c => c.name === 'stable_yields');
                    if (hasStableYields) {
                        console.log('   ✅ stable_yields collection found!');

                        // Try to count documents
                        const count = await mongoose.connection.db.collection('stable_yields').countDocuments();
                        console.log(`   📊 Documents in stable_yields: ${count}`);
                    } else {
                        console.log('   ⚠️  stable_yields collection not found');
                    }
                } else {
                    console.log('   ⚠️  leequid_database not found in database list');
                }

            } catch (dbError) {
                console.log('   ⚠️  Could not list databases (may need admin privileges)');
            }

            await mongoose.disconnect();
            console.log('   🔌 Disconnected\n');

            // If this connection worked, we found our solution
            console.log('🎉 SUCCESS! Use this configuration:');
            console.log(`Connection URL: ${config.url}`);
            console.log(`Options: ${JSON.stringify(config.options, null, 2)}`);
            return;

        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}\n`);

            if (mongoose.connection.readyState === 1) {
                await mongoose.disconnect();
            }
        }
    }

    console.log('❌ All connection attempts failed. Please check:');
    console.log('1. Username and password are correct');
    console.log('2. Server IP and port are accessible');
    console.log('3. User has proper permissions');
    console.log('4. Database and collection names are correct');
}

// Run the test
testDifferentConnections();