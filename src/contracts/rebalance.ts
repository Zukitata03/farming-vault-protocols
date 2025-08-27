/**
 * ERC-4626 Re-allocation/Re-balancing between vaults (Base <-> Arbitrum)
 * - Delta-based: move only what’s needed
 * - Coalesced per vault: ≤1 withdraw & ≤1 deposit per vault per phase
 * - Exit mode: targetWeightsBps = {} or sum = 0  → withdraw all, no bridges/deposits
 * - Fresh allocation: pass wallet USDC via fundUSDC to seed deposits (and bridge net if needed)
 */

import { Address, createPublicClient, http } from "viem";
import { base, arbitrum } from "viem/chains";
import type { ContractCall, Protocol } from "../types/protocol";
import protocols from "../protocols";
import { clientByChain } from "../utils/transport";

/* -------------------- Types -------------------- */
type Chain = "base" | "arbitrum";           // Solana not supported here
type VaultId = string;                       // e.g., "morpho:USDC"
type WeightsBps = Record<VaultId, number>;   // sum ~= 10000 (normalized inside)

/* -------------------- Minimal ERC-4626 ABI -------------------- */
const ERC4626_ABI = [
    { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
    { type: "function", name: "convertToAssets", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

/* -------------------- viem clients -------------------- */
// const clientByChain = {
//     base: createPublicClient({ chain: base, transport: http("https://mainnet.base.org") }),
//     arbitrum: createPublicClient({ chain: arbitrum, transport: http("https://arb1.arbitrum.io/rpc") }),
// } as const;

/* -------------------- Helpers -------------------- */
const sumBig = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);

async function mapPool<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
    const out: R[] = new Array(items.length);
    let i = 0;
    const workers = Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
        while (true) {
            const idx = i++;
            if (idx >= items.length) break;
            out[idx] = await fn(items[idx], idx);
        }
    });
    await Promise.all(workers);
    return out;
}


function protoKey(vaultId: VaultId) {
    const i = vaultId.indexOf(":");
    const head = i > 0 ? vaultId.slice(0, i) : vaultId;
    // Normalize prefixes like "fluid_base" or "fluid_arbitrum" → "fluid"
    return head.split("_")[0];
}

function chainOf(vaultId: VaultId): Chain {
    // Infer chain from vaultId prefix when available (e.g., "fluid_base:USDC")
    const prefix = (vaultId.split(":")[0] || "").toLowerCase();
    if (prefix.includes("_base")) return "base";
    if (prefix.includes("_arbitrum")) return "arbitrum";

    const p: Protocol = (protocols as any)[protoKey(vaultId)];
    if (!p) throw new Error(`Unknown protocol for ${vaultId}`);
    return p.chain as Chain;
}
function normalizeWeightsBps(weights: WeightsBps) {
    const tot = Object.values(weights).reduce((a, b) => a + b, 0);
    if (tot === 0) {
        return Object.fromEntries(Object.keys(weights).map(k => [k, 0])) as WeightsBps;
    }
    if (tot === 10000) return weights;
    const scaled: WeightsBps = {} as any;
    let acc = 0, last: string | null = null;
    for (const [k, v] of Object.entries(weights)) {
        const s = Math.floor((v * 10000) / tot);
        scaled[k as VaultId] = s;
        acc += s; last = k;
    }
    if (last) scaled[last as VaultId] += 10000 - acc; // absorb rounding residue
    return scaled;
}
async function readAssetsUSDC(vaultId: VaultId, user: Address): Promise<bigint> {
    const p: Protocol = (protocols as any)[protoKey(vaultId)];
    const v = p.getVault(vaultId);
    const ch = chainOf(vaultId);
    const client = clientByChain[ch];

    const shareAddr = (v.share ?? v.vault) as `0x${string}`;

    const shares = (await client.readContract({
        address: shareAddr,
        abi: ERC4626_ABI,
        functionName: "balanceOf",
        args: [user],
    })) as bigint;

    if (shares === 0n) return 0n;

    const tryAddrs = Array.from(new Set([shareAddr, v.vault as `0x${string}`])).filter(Boolean) as `0x${string}`[];
    for (const addr of tryAddrs) {
        try {
            const assets = (await client.readContract({
                address: addr,
                abi: ERC4626_ABI,
                functionName: "convertToAssets",
                args: [shares],
            })) as bigint;
            return assets;
        } catch { }
    }

    const shareDec = (v.decimals as any)?.share ?? 18;
    const depDec = (v.decimals as any)?.deposit ?? 6;
    if (shareDec === depDec) return shares;
    if (shareDec > depDec) return shares / (10n ** BigInt(shareDec - depDec));
    return shares * (10n ** BigInt(depDec - shareDec));
}
/* --------- Coalescing (per chain & per side) --------- */
type Side = "withdraw" | "deposit";
type Totals = Record<Chain, { withdraw: Record<VaultId, bigint>; deposit: Record<VaultId, bigint> }>;

function newTotals(): Totals {
    return {
        base: { withdraw: Object.create(null), deposit: Object.create(null) },
        arbitrum: { withdraw: Object.create(null), deposit: Object.create(null) },
    };
}
function addToTotals(t: Totals, chain: Chain, side: Side, vaultId: VaultId, amount: bigint) {
    const bag = t[chain][side];
    bag[vaultId] = (bag[vaultId] ?? 0n) + amount;
}


async function totalsToCalls(
    t: Totals,
    user: Address,
): Promise<Record<Chain, ContractCall[]>> {
    const out: Record<Chain, ContractCall[]> = { base: [], arbitrum: [] };
    for (const ch of ["arbitrum", "base"] as Chain[]) {
        // Withdraws first
        for (const [vaultId, amt] of Object.entries(t[ch].withdraw)) {
            if (amt === 0n) continue;
            const pk = protoKey(vaultId);
            out[ch].push(...await (protocols as any)[pk].withdraw(vaultId, amt, user));
        }
        // Then deposits
        for (const [vaultId, amt] of Object.entries(t[ch].deposit)) {
            if (amt === 0n) continue;
            const pk = protoKey(vaultId);
            out[ch].push(...await (protocols as any)[pk].deposit(vaultId, amt, user));
        }
    }
    return out;
}

/* -------------------- Public API -------------------- */
/**
 * Rebalance across Base/Arbitrum ERC-4626 USDC vaults.
 *
 * - Exit-only: set targetWeightsBps = {} (or sum to 0) → withdraw all (coalesced), no bridges/deposits.
 * - Fresh allocation: pass idle wallet USDC via fundUSDC (per chain) to seed deposits.
 */
export async function rebalance({
    user,
    currentVaultIds,              // vaults you may hold right now (can be empty)
    targetWeightsBps,             // targets for any vaults (missing => 0)
    minMoveUSDC = 0n,             // e.g., parseUnits("25", 6)
    executeCalls,                 // (chain, ContractCall[]) => Promise<void>
    bridgeUSDC,                   // (from, to, amount) => Promise<void>
    fundUSDC,                     // optional wallet USDC floats per chain (for fresh allocation)
}: {
    user: Address;
    currentVaultIds: VaultId[];
    targetWeightsBps: WeightsBps;
    minMoveUSDC?: bigint;
    executeCalls: (chain: Chain, calls: ContractCall[]) => Promise<void>;
    bridgeUSDC: (from: Chain, to: Chain, amount: bigint) => Promise<void>;
    fundUSDC?: Partial<Record<Chain, bigint>>;
}) {
    /* 0) Merge sets (current ∪ target) so we can fully exit or enter */
    const allVaultIds: VaultId[] = Array.from(
        new Set([...currentVaultIds, ...Object.keys(targetWeightsBps)]) as Set<VaultId>
    );

    /* 1) Read positions (USDC) for all relevant vaults */
    const positions = await mapPool(allVaultIds, 10, async (vid) => ({
        id: vid,
        chain: chainOf(vid),
        assets: await readAssetsUSDC(vid, user),
    }));

    const fund: Record<Chain, bigint> = { base: 0n, arbitrum: 0n, ...(fundUSDC || {}) };
    const vaultTotal = sumBig(positions.map(p => p.assets));
    const grandTotal = vaultTotal + fund.base + fund.arbitrum;
    if (grandTotal === 0n) return; // nothing to do at all

    /* 1.1) Exit-only mode: empty or zero-sum targets => withdraw everything, no bridge/deposit */
    const targetSum = Object.values(targetWeightsBps).reduce((a, b) => a + b, 0);
    if (targetSum === 0) {
        const exitTotals = newTotals();
        for (const p of positions) {
            if (p.assets >= minMoveUSDC) {
                addToTotals(exitTotals, p.chain, "withdraw", p.id, p.assets);
            }
        }
        const calls = await totalsToCalls(exitTotals, user);
        if (calls.arbitrum.length) await executeCalls("arbitrum", calls.arbitrum);
        if (calls.base.length) await executeCalls("base", calls.base);
        return;
    }

    /* 2) Targets & deltas (target - current), where targets are % of grandTotal (vaults + funds) */
    // Assign zero to any vault missing from target map
    const rawWeights: WeightsBps = Object.fromEntries(
        allVaultIds.map((id) => [id, targetWeightsBps[id] ?? 0])
    ) as WeightsBps;
    const weights = normalizeWeightsBps(rawWeights);

    const deltas = new Map<VaultId, bigint>();
    let running = 0n;
    allVaultIds.forEach((vid, idx) => {
        const w = BigInt(weights[vid] ?? 0);
        let tgt = (grandTotal * w) / 10000n;
        running += tgt;
        if (idx === allVaultIds.length - 1) tgt += grandTotal - running; // Σtargets == grandTotal
        const cur = positions.find(p => p.id === vid)!.assets;
        deltas.set(vid, tgt - cur); // >0 needs USDC; <0 has surplus
    });

    /* 3) Buckets by chain */
    const buckets = {
        base: { deficits: [] as { id: VaultId; amt: bigint }[], surpluses: [] as { id: VaultId; amt: bigint }[] },
        arbitrum: { deficits: [] as { id: VaultId; amt: bigint }[], surpluses: [] as { id: VaultId; amt: bigint }[] },
    };
    for (const p of positions) {
        const d = deltas.get(p.id)!;
        if (d > 0n) buckets[p.chain].deficits.push({ id: p.id, amt: d });
        else if (d < 0n) buckets[p.chain].surpluses.push({ id: p.id, amt: -d });
    }

    /* 4) Use wallet funds on each chain FIRST (cheap: no withdraw calls) */
    for (const ch of ["arbitrum", "base"] as Chain[]) {
        if (fund[ch] === 0n || !buckets[ch].deficits.length) continue;

        const totals = newTotals();
        let available = fund[ch];

        for (const d of buckets[ch].deficits) {
            if (available === 0n) break;
            const put = d.amt < available ? d.amt : available;
            if (put >= minMoveUSDC) {
                addToTotals(totals, ch, "deposit", d.id, put);
            }
            d.amt -= put;
            available -= put;
        }

        fund[ch] = available;
        const callsByChain = await totalsToCalls(totals, user);
        if (callsByChain[ch].length) await executeCalls(ch, callsByChain[ch]);

        buckets[ch].deficits = buckets[ch].deficits.filter(x => x.amt > 0n);
    }

    /* 5) Intra-chain pairing (coalesced) */
    for (const ch of ["arbitrum", "base"] as Chain[]) {
        const D = buckets[ch].deficits;
        const S = buckets[ch].surpluses;
        if (!D.length || !S.length) continue;

        const totals = newTotals();

        // Optional: sort largest-first to reduce tiny residuals
        // D.sort((a,b)=> (b.amt > a.amt ? 1 : b.amt < a.amt ? -1 : 0));
        // S.sort((a,b)=> (b.amt > a.amt ? 1 : b.amt < a.amt ? -1 : 0));

        let i = 0, j = 0;
        while (i < D.length && j < S.length) {
            const move = D[i].amt < S[j].amt ? D[i].amt : S[j].amt;
            if (move >= minMoveUSDC) {
                addToTotals(totals, ch, "withdraw", S[j].id, move);
                addToTotals(totals, ch, "deposit", D[i].id, move);
            }
            D[i].amt -= move; S[j].amt -= move;
            if (D[i].amt === 0n) i++;
            if (S[j].amt === 0n) j++;
        }

        const callsByChain = await totalsToCalls(totals, user);
        if (callsByChain[ch].length) await executeCalls(ch, callsByChain[ch]);

        // Keep remaining deltas for cross-chain
        buckets[ch].deficits = D.filter(x => x.amt > 0n);
        buckets[ch].surpluses = S.filter(x => x.amt > 0n);
    }

    /* 6) Cross-chain net (Base relative to Arbitrum), include leftover funds */
    const needBase = sumBig(buckets.base.deficits.map(x => x.amt));
    const haveBase = sumBig(buckets.base.surpluses.map(x => x.amt)) + fund.base;
    const netBase = needBase - haveBase; // >0: Base needs inflow; <0: Base can send out

    if (netBase === 0n) return;

    if (netBase > 0n) {
        // Bring USDC from Arbitrum -> Base
        const bridgeAmt = netBase;
        if (bridgeAmt >= minMoveUSDC) {
            // Withdraw only what's needed beyond wallet funds on source chain
            const needFromWithdraws = bridgeAmt > fund.arbitrum ? (bridgeAmt - fund.arbitrum) : 0n;
            if (needFromWithdraws > 0n) {
                const preTotals = newTotals();
                let remaining = needFromWithdraws;
                for (const s of buckets.arbitrum.surpluses) {
                    if (remaining === 0n) break;
                    const take = remaining < s.amt ? remaining : s.amt;
                    addToTotals(preTotals, "arbitrum", "withdraw", s.id, take);
                    remaining -= take;
                }
                const preCalls = await totalsToCalls(preTotals, user);
                if (preCalls.arbitrum.length) await executeCalls("arbitrum", preCalls.arbitrum);
            }

            // Single bridge of the full net amount
            await bridgeUSDC("arbitrum", "base", bridgeAmt);

            // Deposit bridged USDC on Base
            const postTotals = newTotals();
            let left = bridgeAmt;
            for (const d of buckets.base.deficits) {
                if (left === 0n) break;
                const put = left < d.amt ? left : d.amt;
                addToTotals(postTotals, "base", "deposit", d.id, put);
                left -= put;
            }
            const postCalls = await totalsToCalls(postTotals, user);
            if (postCalls.base.length) await executeCalls("base", postCalls.base);
        }
    } else {
        // Send USDC from Base -> Arbitrum
        const bridgeAmt = -netBase;
        if (bridgeAmt >= minMoveUSDC) {
            const needFromWithdraws = bridgeAmt > fund.base ? (bridgeAmt - fund.base) : 0n;
            if (needFromWithdraws > 0n) {
                const preTotals = newTotals();
                let remaining = needFromWithdraws;
                for (const s of buckets.base.surpluses) {
                    if (remaining === 0n) break;
                    const take = remaining < s.amt ? remaining : s.amt;
                    addToTotals(preTotals, "base", "withdraw", s.id, take);
                    remaining -= take;
                }
                const preCalls = await totalsToCalls(preTotals, user);
                if (preCalls.base.length) await executeCalls("base", preCalls.base);
            }

            await bridgeUSDC("base", "arbitrum", bridgeAmt);

            const postTotals = newTotals();
            let left = bridgeAmt;
            for (const d of buckets.arbitrum.deficits) {
                if (left === 0n) break;
                const put = left < d.amt ? left : d.amt;
                addToTotals(postTotals, "arbitrum", "deposit", d.id, put);
                left -= put;
            }
            const postCalls = await totalsToCalls(postTotals, user);
            if (postCalls.arbitrum.length) await executeCalls("arbitrum", postCalls.arbitrum);
        }
    }
}
