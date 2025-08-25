import dotenv from "dotenv";
dotenv.config();

import { fetchVaults } from "../contracts/fetchVaults";
import { rebalance } from "../contracts/rebalance";
import { executeCallsEthers, getAddressFromMnemonicEthers } from "../contracts/contractInteractor";
import { bridgeUSDC as bridgeUSDCImpl } from "../contracts/bridge";
import { formatUnits, parseUnits } from "ethers";
import { vaults } from "../registry/vault.base";
import { maxUint256 } from "viem";

type StrategyKey = "S1" | "S2";
type Chain = "base" | "arbitrum";

// === DRY RUN ===
// DRY_RUN=true (default) → query-only: read balances, compute plan, LOG actions (no tx, no bridge)
const DRY_RUN = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";

const DB_TO_VAULT: Record<string, { id: string; chain: Chain } | undefined> = {
    "wasabi_base_usdc": { id: "wasabi:USDC", chain: "base" },
    "tokemak_base_usdc_baseusd": { id: "tokemak:USDC", chain: "base" },
    "fluid-lending_base_usdc": { id: "fluid_base:USDC", chain: "base" },
    "maxapy_base_usdc": { id: "maxapy:USDC", chain: "base" },
    "morpho-blue_base_mwusdc": { id: "morpho:USDC", chain: "base" },
    "silo-v2_arbitrum_usdc_127": { id: "silo:USDC", chain: "arbitrum" },
    "fluid-lending_arbitrum_usdc": { id: "fluid_arbitrum:USDC", chain: "arbitrum" },
    // wasabi_solana_usdc — skipped (non-ERC4626 / non-EVM here)
};

const CURRENT_VAULT_UNIVERSE: string[] = [
    "morpho:USDC",
    "wasabi:USDC",
    "tokemak:USDC",
    "maxapy:USDC",
    "fluid_base:USDC",
    "fluid_arbitrum:USDC",
    "silo:USDC",
    "beefy:USDC",
];

// ======== Helpers ========
function mnemonicFor(chain: Chain) {
    return chain === "base"
        ? process.env.MNEMONIC_BASE || process.env.MNEMONIC || ""
        : process.env.MNEMONIC_ARBITRUM || process.env.MNEMONIC || "";
}

function requireMnemonic(chain: Chain) {
    const m = mnemonicFor(chain);
    if (!m) throw new Error(`Missing mnemonic for ${chain} (MNEMONIC_${chain.toUpperCase()} or MNEMONIC)`);
    return m;
}

function resolveUserAddress(): `0x${string}` {
    const envAddr = process.env.USER_ADDRESS?.trim();
    if (envAddr) return envAddr as `0x${string}`;
    // Derive from base mnemonic as a fallback
    const m = mnemonicFor("base");
    if (!m && DRY_RUN) {
        throw new Error("Set USER_ADDRESS (for query-only) or provide MNEMONIC[_BASE] to derive the address.");
    }
    const addr = getAddressFromMnemonicEthers({ network: "base", mnemonic: requireMnemonic("base") });
    return addr as `0x${string}`;
}

// Real executors
async function executeCallsReal(chain: Chain, calls: any[]) {
    const ctx = { network: chain, mnemonic: requireMnemonic(chain) } as const;
    await executeCallsEthers(ctx, calls);
}
async function bridgeUSDCReal(from: Chain, to: Chain, amount: bigint) {
    const human = formatUnits(amount, 6);
    await bridgeUSDCImpl(from, to, human);
}

// DRY-RUN executors (log only)
async function executeCallsDry(chain: Chain, calls: any[]) {
    if (!calls?.length) return;
    console.log(`\n[DRY RUN] executeCalls[${chain}] x${calls.length}`);
    calls.forEach((c, i) => console.log(`  • #${i + 1}`, c));
}
async function bridgeUSDCDry(from: Chain, to: Chain, amount: bigint) {
    console.log(`\n[DRY RUN] bridge USDC ${from} → ${to}: ${formatUnits(amount, 6)} USDC`);
}

// Choose which to use
const executeCalls = DRY_RUN ? executeCallsDry : executeCallsReal;
const bridgeUSDC = DRY_RUN ? bridgeUSDCDry : bridgeUSDCReal;

function toBps(weights01: Record<string, number>) {
    const entries = Object.entries(weights01)
        .filter(([, w]) => w > 0)
        .map(([k, w]) => [k, Math.max(0, w)] as const);
    const sum = entries.reduce((a, [, w]) => a + w, 0);
    if (sum === 0) return {} as Record<string, number>;
    const scaled: Array<[string, number]> = entries.map(([k, w]) => [k, Math.floor((w * 10000) / sum)]);
    let acc = scaled.reduce((a, [, v]) => a + v, 0);
    if (scaled.length && acc !== 10000) {
        const [k, v] = scaled[scaled.length - 1];
        scaled[scaled.length - 1] = [k, v + (10000 - acc)];
    }
    return Object.fromEntries(scaled);
}

export async function runAllocation(strategy: StrategyKey = "S1") {
    const user = resolveUserAddress();

    // 1) Fetch snapshot + strategies (S1 default K=3)
    const { allocations } = await fetchVaults();
    const alloc = allocations?.[strategy] || {};
    if (!alloc || Object.keys(alloc).length === 0) throw new Error("No strategy allocations available");

    // 2) Map DB ids -> protocol vault ids; drop unsupported
    const mapped: Record<string, number> = {};
    for (const [dbId, w] of Object.entries(alloc)) {
        const m = DB_TO_VAULT[dbId];
        if (!m) continue;
        mapped[m.id] = (mapped[m.id] ?? 0) + w;
    }

    // 3) Convert to basis points
    const targetWeightsBps = toBps(mapped);

    const fundBase = parseUnits("10000", 6);
    const fundArb = parseUnits("10000", 6);

    console.log("targetWeightsBps", targetWeightsBps);
    console.log("fundBase", fundBase);
    console.log("fundArb", fundArb);

    // 5) Rebalance (delta-based). In DRY_RUN it will only log planned actions.
    await rebalance({
        user,
        currentVaultIds: CURRENT_VAULT_UNIVERSE,
        targetWeightsBps,
        minMoveUSDC: parseUnits(process.env.MIN_MOVE_USDC || "0", 6),
        executeCalls,
        bridgeUSDC,
        fundUSDC: { base: fundBase, arbitrum: fundArb },
    });

    if (DRY_RUN) {
        console.log("\n✅ DRY RUN complete (no transactions sent, no bridges executed).");
    }
}






if (typeof require !== "undefined" && require.main === module) {
    const strategy = (process.env.STRATEGY as "S1" | "S2") || "S1";
    const dry = (process.env.DRY_RUN ?? "true").toLowerCase() !== "false";
    console.log(`\n🚀 AllocateRebalance start | strategy=${strategy} | DRY_RUN=${dry}`);

    runAllocation(strategy)
        .then(() => {
            console.log("✅ Done.");
        })
        .catch((err) => {
            console.error("💥 Fatal:", err);
            process.exit(1);
        });
}