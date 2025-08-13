import mongoose, { Schema, Document, Model } from 'mongoose';
import { VaultDoc as IVaultDoc } from '../strategies/vaultdoc';
import { ACTIVE_VAULT_IDS } from '../strategies/index';

// Extend the VaultDoc interface to work with Mongoose
export interface VaultDoc extends IVaultDoc {
    _id: string;
}

// Define the comprehensive Mongoose schema for stable_yields collection
const vaultSchema = new Schema<VaultDoc>({
    _id: { type: String, required: true },
    apy: { type: Number },
    apyBase: { type: Number },
    apyBase7d: { type: Number },
    apyBaseInception: { type: Number },
    apyMean30d: { type: Number },
    apyPct1D: { type: Number },
    apyPct30D: { type: Number },
    apyPct7D: { type: Number },
    apyReward: { type: Number },
    chain: { type: String },
    chain_id: { type: Number },
    depositFee: { type: Number },
    exposure: { type: String },
    il7d: { type: Number },
    ilRisk: { type: String },
    isContractAudited: { type: Boolean },
    isRewardPending: { type: Boolean },
    lastUpdatedAt: { type: String },
    pool: { type: String },
    poolMeta: { type: Schema.Types.Mixed },
    project: { type: String },
    rewardTokens: [{ type: String }],
    socialRanking: { type: Number },
    stablecoin: { type: Boolean },
    symbol: { type: String },
    tvlUsd: { type: Number },
    underlyingTokens: [{ type: String }],
    volumeUsd1d: { type: Number },
    volumeUsd7d: { type: Number },
    withdrawFee: { type: Number },
    withdrawLockPeriod: { type: Number },
    auditDocumentLink: { type: String },
    category: { type: String },
    managementFee: { type: Number },
    performanceFee: { type: Number },
    socialLink: { type: String },
    apyLogs: [{ type: Schema.Types.Mixed }]
}, {
    collection: 'stable_yields',
    _id: false,
    strict: false
});

// Create the model for the stable_yields collection in leequid_database
export const StableYield: Model<VaultDoc> = mongoose.model<VaultDoc>('StableYield', vaultSchema);

export class MongooseHelper {
    private isConnected: boolean = false;

    constructor(private connectionString: string) { }

    async connect(): Promise<void> {
        if (this.isConnected) {
            return;
        }

        try {
            // Based on the diagnostic results, connect to admin first, then switch to leequid_database
            // const adminConnectionString = this.connectionString.replace('/leequid_database', );

            await mongoose.connect(this.connectionString, {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 45000,
                bufferCommands: false,
                maxPoolSize: 10,
                maxIdleTimeMS: 10000,
                connectTimeoutMS: 10000,
                family: 4,
                ssl: false,
                tls: false,
                replicaSet: undefined,
                authSource: "admin",
            });

            // Now switch to the leequid_database
            await mongoose.connection.useDb('leequid_database');

            this.isConnected = true;
            console.log('✅ Connected to MongoDB - Database: leequid_database, Collection: stable_yields');
        } catch (error) {
            console.error('❌ Failed to connect to MongoDB:', error.message);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.isConnected) {
            await mongoose.disconnect();
            this.isConnected = false;
            console.log('Disconnected from MongoDB');
        }
    }

    async getActiveVaults(): Promise<IVaultDoc[]> {
        try {
            const vaults = await StableYield.find({
                _id: { $in: ACTIVE_VAULT_IDS }
            }).lean();

            console.log(`Retrieved ${vaults.length} active vaults from leequid_database.stable_yields`);
            return vaults;
        } catch (error) {
            console.error('Failed to retrieve active vaults:', error);
            throw error;
        }
    }

    async getVaultsByIds(ids: string[]): Promise<IVaultDoc[]> {
        try {
            const vaults = await StableYield.find({
                _id: { $in: ids }
            }).lean();

            console.log(`Retrieved ${vaults.length} vaults from leequid_database.stable_yields`);
            return vaults;
        } catch (error) {
            console.error('Failed to retrieve vaults by IDs:', error);
            throw error;
        }
    }

    async getAllVaults(): Promise<IVaultDoc[]> {
        try {
            const vaults = await StableYield.find({}).lean();
            console.log(`Retrieved ${vaults.length} total vaults from leequid_database.stable_yields`);
            return vaults;
        } catch (error) {
            console.error('Failed to retrieve all vaults:', error);
            throw error;
        }
    }

    async getVaultById(id: string): Promise<IVaultDoc | null> {
        try {
            const vault = await StableYield.findById(id).lean();
            return vault;
        } catch (error) {
            console.error(`Failed to retrieve vault with ID ${id}:`, error);
            throw error;
        }
    }

    async verifyConnection(): Promise<void> {
        try {
            // Check current database
            const currentDb = mongoose.connection.db.databaseName;
            console.log(`📂 Connected to database: ${currentDb}`);

            // List collections in current database
            const collections = await mongoose.connection.db.listCollections({ name: 'stable_yields' }).toArray();
            if (collections.length === 0) {
                console.warn('⚠️  Collection "stable_yields" not found in leequid_database');

                // List all available collections
                const allCollections = await mongoose.connection.db.listCollections().toArray();
                console.log('📋 Available collections:', allCollections.map(c => c.name));
            } else {
                console.log('✅ Successfully connected to leequid_database.stable_yields');
            }

            // Get collection stats
            const stats = await mongoose.connection.db.collection('stable_yields').stats();
            console.log(`📊 Collection stats: ${stats.count} documents, ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        } catch (error) {
            console.error('Failed to verify connection:', error);
        }
    }

    // Additional helper methods
    async getVaultsByChain(chain: string): Promise<IVaultDoc[]> {
        try {
            const vaults = await StableYield.find({ chain }).lean();
            console.log(`Retrieved ${vaults.length} vaults from ${chain} chain`);
            return vaults;
        } catch (error) {
            console.error(`Failed to retrieve vaults for chain ${chain}:`, error);
            throw error;
        }
    }

    async getStablecoinVaults(): Promise<IVaultDoc[]> {
        try {
            const vaults = await StableYield.find({ stablecoin: true }).lean();
            console.log(`Retrieved ${vaults.length} stablecoin vaults`);
            return vaults;
        } catch (error) {
            console.error('Failed to retrieve stablecoin vaults:', error);
            throw error;
        }
    }

    async getVaultsByProject(project: string): Promise<IVaultDoc[]> {
        try {
            const vaults = await StableYield.find({ project }).lean();
            console.log(`Retrieved ${vaults.length} vaults from project ${project}`);
            return vaults;
        } catch (error) {
            console.error(`Failed to retrieve vaults for project ${project}:`, error);
            throw error;
        }
    }
}

// Utility function using the successful configuration from diagnostic
export function createMongooseHelper(): MongooseHelper {
    const baseConnectionString = process.env.MONGODB_CONNECTION_STRING;

    if (!baseConnectionString) {
        throw new Error('MONGODB_CONNECTION_STRING environment variable is required');
    }

    let connectionString = baseConnectionString.trim();

    // Remove quotes if present
    if (connectionString.startsWith('"') && connectionString.endsWith('"')) {
        connectionString = connectionString.slice(1, -1);
    }

    // Ensure the connection string points to leequid_database
    if (!connectionString.includes('/leequid_database')) {
        if (connectionString.endsWith('/')) {
            connectionString += 'leequid_database';
        } else {
            connectionString += '/leequid_database';
        }
    }

    // Log connection details (hide password)
    const logSafeString = connectionString.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`🔗 Using connection: ${logSafeString}`);

    return new MongooseHelper(connectionString);
}