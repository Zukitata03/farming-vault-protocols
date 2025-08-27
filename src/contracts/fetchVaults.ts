import dotenv from 'dotenv';
import { createMongooseHelper } from '../utils/mongoHelper';
import { runStrategy } from '../strategies/index';

dotenv.config();

// const TARGET_VAULT_IDS = [
//     "0x2105_e072ad15-4705-4a3f-9ed6-4a86fe6eb72f",
//     "0x2105_f03ea9e8-b17a-46f2-8a02-ff8486f939d2",
//     "0x2105_7372edda-f07f-4598-83e5-4edec48c4039",
//     "0x2105_8c2b9daa-063d-4c36-a41a-13ef82d99c47",
//     "0x2105_1643c124-f047-4fc5-9642-d6fa91875184",
//     "0xa4b1_2d75a8dd-f4bd-4ed9-a006-445df75be02c",
//     "0xa4b1_4c45cc9e-e1a4-43c9-8a3d-687d96abb07c",
// ];
const TARGET_VAULT_IDS = [
    "wasabi_base_usdc",
    "tokemak_base_usdc_baseusd",
    "fluid-lending_base_usdc",
    "maxapy_base_usdc",
    "morpho-blue_base_mwusdc",
    "silo-v2_arbitrum_usdc_127",
    "fluid-lending_arbitrum_usdc",
    "wasabi_solana_usdc",
    "kamino-lend_solana_usdc"

]
function formatNumber(value: number | undefined, decimals = 2): string {
    if (value === undefined || value === null) return 'N/A';
    return value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatPercentage(value: number | undefined, decimals = 2): string {
    if (value === undefined || value === null) return 'N/A';
    return value.toFixed(decimals) + '%';
}

function formatCurrency(value: number | undefined): string {
    if (value === undefined || value === null) return 'N/A';
    return '$' + value.toLocaleString();
}

function isFresh(iso?: string | number, maxHrs = 168) {
    if (!iso) return false;

    // Handle both ISO string and Unix timestamp
    const timestamp = typeof iso === 'string' ? new Date(iso).getTime() : iso * 1000;
    const ageHours = (Date.now() - timestamp) / 36e5;
    return ageHours <= maxHrs;
}

function debugVaultData(vaults: any[]) {
    console.log('\n🔍 === VAULT DATA DEBUGGING ===');

    vaults.forEach((vault, index) => {
        console.log(`\nVault ${index + 1}: ${vault._id}`);
        console.log(`  Project: ${vault.project || 'UNDEFINED'}`);
        console.log(`  Chain: ${vault.chain || 'UNDEFINED'}`);
        console.log(`  APY: ${vault.apy || 'UNDEFINED'}`);
        console.log(`  Stablecoin: ${vault.stablecoin !== undefined ? vault.stablecoin : 'UNDEFINED'}`);
        console.log(`  TVL USD: ${vault.tvlUsd || 'UNDEFINED'}`);
        console.log(`  Last Updated: ${vault.lastUpdatedAt || 'UNDEFINED'}`);
        console.log(`  Management Fee: ${vault.managementFee || 'UNDEFINED'}`);
        console.log(`  Performance Fee: ${vault.performanceFee || 'UNDEFINED'}`);

        // Check if vault would pass S1 filters
        const stablecoinOk = vault.stablecoin ?? true;
        const isFreshOk = isFresh(vault.lastUpdatedAt, 168);
        const tvlOk = (vault.tvlUsd ?? 0) >= 0;
        const hasApy = vault.apy !== undefined;

        console.log(`  ✅ Passes filters:`);
        console.log(`    - Stablecoin: ${stablecoinOk}`);
        console.log(`    - Fresh (24h): ${isFreshOk}`);
        console.log(`    - TVL >= 0: ${tvlOk}`);
        console.log(`    - Has APY: ${hasApy}`);

        if (hasApy) {
            const netApy = vault.apy - (vault.managementFee ?? 0) - (vault.performanceFee ?? 0);
            console.log(`    - Net APY: ${netApy.toFixed(4)}%`);
        }
    });
}

function displayStrategyAllocations(vaults: any[], strategies: string[] = ['S1', 'S2']) {
    console.log('\n🎯 === STRATEGY ALLOCATIONS COMPARISON ===');

    // Debug vault data first
    debugVaultData(vaults);

    const allocations: Record<string, Record<string, number>> = {};
    const strategyNames = {
        'S1': 'Strategy 1 (Top-K Equal Weight)',
        'S2': 'Strategy 2 (Risk-Adjusted)',
        // 'S5': 'Strategy 3 (Advanced Optimization)'
    };

    // Run all strategies
    for (const strategy of strategies) {
        try {
            console.log(`\n📊 === Running ${strategyNames[strategy as keyof typeof strategyNames]} ===`);

            const allocation = runStrategy(strategy as 'S1' | 'S2', vaults);

            console.log(`🔍 Raw allocation result:`, allocation);
            console.log(`🔍 Number of allocated vaults: ${Object.keys(allocation).length}`);
            console.log(`🔍 Total allocation: ${Object.values(allocation).reduce((a, b) => a + b, 0) * 100}%`);

            allocations[strategy] = allocation;
        } catch (error) {
            console.log(`⚠️  Could not run ${strategy}:`);
            console.log(`   Error: ${error.message}`);
            console.log(`   Stack: ${error.stack}`);
            allocations[strategy] = {};
        }
    }

    // Show detailed allocation breakdown
    console.log('\n📈 === DETAILED ALLOCATION BREAKDOWN ===');

    Object.entries(allocations).forEach(([strategy, allocation]) => {
        console.log(`\n${strategyNames[strategy as keyof typeof strategyNames]}:`);

        if (Object.keys(allocation).length === 0) {
            console.log('  ❌ No allocations generated');
            return;
        }

        Object.entries(allocation).forEach(([vaultId, weight]) => {
            const vault = vaults.find(v => v._id === vaultId);
            const percentage = (weight * 100).toFixed(2);

            if (vault) {
                console.log(`  📊 ${percentage}% → ${vault.project || 'Unknown Project'} (${vault.chain || 'Unknown Chain'})`);
                console.log(`      Vault: ${vaultId}`);
                console.log(`      APY: ${formatPercentage(vault.apy)}, TVL: ${formatCurrency(vault.tvlUsd)}`);
            } else {
                console.log(`  📊 ${percentage}% → Unknown Vault: ${vaultId}`);
            }
        });
    });

    return allocations;
}

async function fetchVaults() {
    const mongoHelper = createMongooseHelper();

    try {
        await mongoHelper.connect();
        await mongoHelper.verifyConnection();

        console.log('🔍 Fetching vault data for strategy analysis...');
        const vaults = await mongoHelper.getVaultsByIds(TARGET_VAULT_IDS);

        if (vaults.length === 0) {
            console.log('❌ No vaults found');
            return { vaults: [] };
        }

        console.log(`✅ Retrieved ${vaults.length} vaults`);

        // Show basic summary
        console.log('\n📊 === VAULT SUMMARY ===');
        vaults.forEach((vault, index) => {
            console.log(`${index + 1}. ${vault.project || 'Unknown'} (${vault.chain || 'Unknown'}) - APY: ${formatPercentage(vault.apy)} - TVL: ${formatCurrency(vault.tvlUsd)}`);
        });

        // Run strategy allocations with detailed debugging
        const allocations = displayStrategyAllocations(vaults);

        return { vaults, allocations };

    } catch (error) {
        console.error('❌ Error fetching vaults:', error);
        throw error;
    } finally {
        await mongoHelper.disconnect();
    }
}

// Run the script if called directly
if (require.main === module) {
    fetchVaults()
        .then(result => {
            console.log('\n✅ Script completed successfully');
            if (result.vaults.length > 0) {
                console.log(`📊 Retrieved ${result.vaults.length} vault(s) and analyzed ${Object.keys(result.allocations || {}).length} strategies`);
            }
        })
        .catch(error => {
            console.error('❌ Script failed:', error.message);
            process.exit(1);
        });
}

export { fetchVaults };