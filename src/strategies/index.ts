import { buildAllocationS1, type StrategyParams as ParamsS1 } from "./s1";
import { buildAllocationS2, type StrategyParams as ParamsS2 } from "./s2";
// import { buildAllocationS5, type StrategyParams as ParamsS5 } from "./s3";
import { VaultDoc } from "./vaultdoc";


export const ACTIVE_VAULT_IDS = [
    "wasabi_base_usdc",
    "tokemak_base_usdc_baseusd",
    "fluid-lending_base_usdc",
    // "maxapy_base_usdc",
    "morpho-blue_base_mwusdc",
    "silo-v2_arbitrum_usdc_127",
    "fluid-lending_arbitrum_usdc",
    "wasabi_solana_usdc",
] as const;

// Use a fake KAMINO ID that doesn't exist in our universe - this will get 0% allocation
const SAFE_ID = "KAMINO_FAKE_NOT_IN_ACTIVE_LIST";

// Base params shared across strategies - modified to skip KAMINO and use all 7 vaults
const baseParams = {
    kaminoId: SAFE_ID,           // Non-existent ID so it gets 0%
    fixedSafeShare: 0.0,         // 0% to KAMINO (skip it entirely)
    dynamicPoolShare: 1.0,       // 100% to the active vaults
    allowOverflowToSafe: false,
    maxStalenessHours: 168,      // Allow data up to 7 days old
    minTvlUsd: 0,
} satisfies Partial<ParamsS1 & ParamsS2>; // & ParamsS5>;

export function runStrategy(
    strategy: "S1" | "S2",
    snapshot: VaultDoc[],
) {
    // filter to current active universe
    const vaults = snapshot.filter(v => ACTIVE_VAULT_IDS.includes(v._id as any));
    if (vaults.length === 0) throw new Error("No active vaults found in snapshot");

    let alloc: Record<string, number>;
    if (strategy === "S1") {
        alloc = buildAllocationS1(vaults, baseParams);
    } else if (strategy === "S2") {
        alloc = buildAllocationS2(vaults, baseParams);
    }
    // else {
    // //     alloc = buildAllocationS5(vaults, baseParams);
    // // }

    // Remove the fake KAMINO entry if it exists with 0% allocation
    if (alloc[SAFE_ID] === 0 || alloc[SAFE_ID] === undefined) {
        delete alloc[SAFE_ID];
    }

    // pretty print
    const rows = Object.entries(alloc).map(([id, w]) => ({ id, weightPct: (w * 100).toFixed(2) + "%" }));
    const total = Object.values(alloc).reduce((a, b) => a + b, 0);
    console.table(rows);
    console.log("Total:", (total * 100).toFixed(2) + "%");
    return alloc;
}