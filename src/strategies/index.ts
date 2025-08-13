import { buildAllocationS1, type StrategyParams as ParamsS1 } from "./s1";
import { buildAllocationS2, type StrategyParams as ParamsS2 } from "./s2";
import { buildAllocationS5, type StrategyParams as ParamsS5 } from "./s3";
import { VaultDoc } from "./vaultdoc";

// Your 7 active vault IDs (Base + Arbitrum)
export const ACTIVE_VAULT_IDS = [
    "0x2105_e072ad15-4705-4a3f-9ed6-4a86fe6eb72f", // Wasabi (Base)
    "0x2105_f03ea9e8-b17a-46f2-8a02-ff8486f939d2", // Tokemak (Base)
    "0x2105_7372edda-f07f-4598-83e5-4edec48c4039", // Fluid (Base)
    "0x2105_8c2b9daa-063d-4c36-a41a-13ef82d99c47", // MaxAPY (Base)
    "0x2105_1643c124-f047-4fc5-9642-d6fa91875184", // Morpho (Base)
    "0xa4b1_2d75a8dd-f4bd-4ed9-a006-445df75be02c", // Silo (Arbitrum)
    "0xa4b1_4c45cc9e-e1a4-43c9-8a3d-687d96abb07c", // Fluid ARB (Arbitrum)
] as const;

// Use a fake KAMINO ID that doesn't exist in our universe - this will get 0% allocation
const SAFE_ID = "KAMINO_FAKE_NOT_IN_ACTIVE_LIST";

// Base params shared across strategies - modified to skip KAMINO and use all 7 vaults
const baseParams = {
    kaminoId: SAFE_ID,           // Non-existent ID so it gets 0%
    fixedSafeShare: 0.0,         // 0% to KAMINO (skip it entirely)
    dynamicPoolShare: 1.0,       // 100% to the active vaults
    allowOverflowToSafe: false,
    maxStalenessHours: 168,      // Allow data up to 7 days old (instead of 24 hours)
    minTvlUsd: 0,
} satisfies Partial<ParamsS1 & ParamsS2 & ParamsS5>;

export function runStrategy(
    strategy: "S1" | "S2" | "S5",
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
    } else {
        alloc = buildAllocationS5(vaults, baseParams);
    }

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