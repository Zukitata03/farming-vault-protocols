import { ethers } from "ethers";

/**
 * ERC-4626 PnL tracker (receipts-based, ethers v6)
 * - Cost basis = sum(convertToAssets(mintedShares at tx.block)) - sum(convertToAssets(burnedShares at tx.block))
 * - Current value = convertToAssets(balanceOf(wallet)) at latest block
 * - Robust to provider rate limits via per-RPC pacing + retries
 */

/* ===================== Types ===================== */
type SharesAtBlock = { shares: string; block: number };
type VaultCfg = {
    name: string;
    rpc: string;
    address: string;
    txs?: string[];                 // <- put your deposit/withdraw tx hashes here
    manualAssetsIn?: string;        // optional fallback: exact asset amount (e.g., "33.4")
    sharesAtBlocks?: SharesAtBlock[]; // optional fallback: use known shares at historical blocks
};
type StrategyCfg = {
    name: string;
    wallet: string;
    vaults: VaultCfg[];
};

// === Multicall3 (ADD under ABIs) ===
// Same address on Base + Arbitrum
const MULTICALL3_ADDR = "0xCA11bde05977b3631167028862bE2a173976CA11" as const;
const MULTICALL3_ABI = [
    "function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)"
];
type MC3Call = { target: string; allowFailure: boolean; callData: string };





/* ===================== CONFIG ===================== */
// Example config (txs empty; fill them with your hashes)
const STRATEGIES: StrategyCfg[] = [
    {
        name: "Strategy 1",
        wallet: "0x7227fF47efeC35f3D72375143146b70F5D1ec53d",
        vaults: [
            { name: "silo-v2", rpc: "https://arbitrum-one.public.blastapi.io", address: "0x2433D6AC11193b4695D9ca73530de93c538aD18a", txs: ["0x82b4add0556f1cfbe21a377700517b103db199fc0035c01f48d1ec0c6433bc36"] },
            { name: "wasabi", rpc: "https://mainnet.base.org", address: "0x1C4a802FD6B591BB71dAA01D8335e43719048B24", txs: ["0x4fe799c24f706fff2cfc095482649b44daf05ab290670e1792475ebd6446d748"] },
            { name: "maxapy", rpc: "https://mainnet.base.org", address: "0x7a63e8FC1d0A5E9BE52f05817E8C49D9e2d6efAe", txs: ["0x2b81413833a17cf642549053b2223698b094c1e3f05890edd90ed1338f92f2f3"] },
        ],
    },
    {
        name: "Strategy 2",
        wallet: "0x0Be1c76f6B075EdC0E3Dfb99D012fC0CE9206f55",
        vaults: [
            { name: "wasabi", rpc: "https://mainnet.base.org", address: "0x1C4a802FD6B591BB71dAA01D8335e43719048B24", txs: ["0xe0e7cb2e33b3274bd9e3a2a9b873264a7ccf073031af1f01a27c5ab1f6d1185b"] },
            { name: "tokemak", rpc: "https://mainnet.base.org", address: "0x9c6864105AEC23388C89600046213a44C384c831", txs: ["0x5113055b0e6bb3f602778b85829c9e280651717ec3f2fcb5cde70ca97f2cac70"] },
            { name: "maxapy", rpc: "https://mainnet.base.org", address: "0x7a63e8FC1d0A5E9BE52f05817E8C49D9e2d6efAe", txs: ["0x92463ac7b89f7eab66ab141de16da0edac1b93e16e883d38e3d6df170fa82876"] },
        ],
    },
];

/* ===================== Infra: providers, pacing, retries ===================== */
const providerCache: Record<string, ethers.JsonRpcProvider> = {};
const nextAvailableAt: Record<string, number> = {};

function getProvider(rpc: string) {
    if (!providerCache[rpc]) {
        providerCache[rpc] = new ethers.JsonRpcProvider(rpc);
        nextAvailableAt[rpc] = 0;
    }
    return providerCache[rpc];
}

// === Helper (ADD under Helpers) ===
async function readSharesAndAssetsAtBlock(
    vaultAddr: string,
    wallet: string,
    blockTag: number,
    rpc: string
): Promise<{ shares: bigint; assets: bigint }> {
    const provider = getProvider(rpc);
    const erc4626 = new ethers.Contract(vaultAddr, ERC4626_ABI, provider);

    try {
        // Multicall3 batch
        const mc = new ethers.Contract(MULTICALL3_ADDR, MULTICALL3_ABI, provider);
        const iface = new ethers.Interface(ERC4626_ABI);
        const calls: MC3Call[] = [
            { target: vaultAddr, allowFailure: false, callData: iface.encodeFunctionData("balanceOf", [wallet]) },
            { target: vaultAddr, allowFailure: false, callData: iface.encodeFunctionData("convertToAssets", [ethers.MaxUint256]) } // placeholder; we’ll re-call with real shares below if needed
        ];
        // We need shares first to compute assets; do a two-step but still on same block:
        const [sharesRaw]: [bigint] = await safeCall(rpc, () => erc4626.balanceOf(wallet, { blockTag }));
        const assets = await safeCall(rpc, () => erc4626.convertToAssets(sharesRaw, { blockTag }));
        return { shares: sharesRaw, assets };
    } catch {
        // Fallback: two separate calls pinned to block
        const shares = await safeCall(rpc, () => erc4626.balanceOf(wallet, { blockTag }));
        const assets = await safeCall(rpc, () => erc4626.convertToAssets(shares, { blockTag }));
        return { shares, assets };
    }
}


function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

async function pace(rpc: string, minGapMs = 300) {
    const now = Date.now();
    const wait = Math.max(0, (nextAvailableAt[rpc] ?? 0) - now);
    if (wait > 0) await sleep(wait);
    nextAvailableAt[rpc] = Date.now() + minGapMs;
}

function isRateLimitError(e: any): boolean {
    const m = e?.info?.error?.message || e?.shortMessage || e?.message || e?.reason || "";
    const code = e?.info?.error?.code ?? e?.code;
    return /over rate limit|rate limit|429|too many requests/i.test(m) || code === -32016;
}

async function withRetries<T>(fn: () => Promise<T>, { tries = 6, baseDelayMs = 500, maxDelayMs = 10_000 } = {}): Promise<T> {
    let attempt = 0;
    while (true) {
        try { return await fn(); }
        catch (e: any) {
            attempt++;
            if (!isRateLimitError(e) || attempt >= tries) throw e;
            const backoff = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
            const jitter = Math.floor(Math.random() * 300);
            const delay = backoff + jitter;
            console.warn(`Rate limit (attempt ${attempt}/${tries}). Retrying in ${Math.round(delay)}ms...`);
            await sleep(delay);
        }
    }
}

async function safeCall<T>(rpc: string, call: () => Promise<T>): Promise<T> {
    await pace(rpc);
    return withRetries(call);
}

/* ===================== ABIs ===================== */
const ERC4626_ABI = [
    "function asset() view returns (address)",
    "function decimals() view returns (uint8)",         // share decimals
    "function balanceOf(address) view returns (uint256)",
    "function convertToAssets(uint256 shares) view returns (uint256)",
];
const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
];
const ERC20_TRANSFER_ABI = [
    "event Transfer(address indexed from, address indexed to, uint256 value)",
];

/* ===================== Helpers ===================== */
const fmtUnits = (x: bigint, d: number) => ethers.formatUnits(x, d);
const pct = (x: number) => (x * 100).toFixed(2) + "%";

/**
 * Build cost basis from a small set of tx receipts by:
 * - reading minted/burned share amounts from Transfer events emitted by the vault (ERC20 share token)
 * - valuing those shares at the historical block via convertToAssets(..., { blockTag })
 */
async function costBasisFromReceipts(vault: VaultCfg, wallet: string): Promise<bigint> {
    const rpc = vault.rpc;
    const provider = getProvider(rpc);
    const shareTokenAddr = ethers.getAddress(vault.address);
    const zero = ethers.ZeroAddress;

    if (!vault.txs || vault.txs.length === 0) {
        return 0n;
    }
    const transferIface = new ethers.Interface(ERC20_TRANSFER_ABI);
    const transferTopic = transferIface.getEvent("Transfer").topicHash;
    const erc4626 = new ethers.Contract(vault.address, ERC4626_ABI, provider);

    let assetsIn = 0n;
    let assetsOut = 0n;
    const walletAddr = ethers.getAddress(wallet);

    for (const hash of vault.txs) {
        const rcpt = await safeCall(rpc, () => provider.getTransactionReceipt(hash));
        // Only consider Transfer events emitted by the vault (the share token)
        const logs = rcpt.logs.filter(l => l.address.toLowerCase() === shareTokenAddr.toLowerCase() && l.topics[0] === transferTopic);

        for (const log of logs) {
            const ev = transferIface.decodeEventLog("Transfer", log.data, log.topics) as unknown as { from: string; to: string; value: bigint; };
            const from = ethers.getAddress(ev.from);
            const to = ethers.getAddress(ev.to);
            const shares: bigint = ev.value;

            if (from === zero && to === walletAddr) {
                // minted shares (deposit)
                const assetsAtBlock = await safeCall(rpc, () => erc4626.convertToAssets(shares, { blockTag: rcpt.blockNumber }));
                assetsIn += assetsAtBlock;
            } else if (from === walletAddr && to === zero) {
                // burned shares (withdraw)
                const assetsAtBlock = await safeCall(rpc, () => erc4626.convertToAssets(shares, { blockTag: rcpt.blockNumber }));
                assetsOut += assetsAtBlock;
            }
        }
    }
    return assetsIn - assetsOut;
}

/**
 * Fallbacks if receipts aren’t provided/available:
 *  1) sharesAtBlocks[] → sum(convertToAssets(shares, { blockTag }))
 *  2) manualAssetsIn (string) → parsed to asset units
 */
async function fallbackCostBasis(vault: VaultCfg, assetDecimals: number): Promise<bigint> {
    const rpc = vault.rpc;
    const provider = getProvider(rpc);
    const erc4626 = new ethers.Contract(vault.address, ERC4626_ABI, provider);

    // shares@blocks
    if (vault.sharesAtBlocks && vault.sharesAtBlocks.length > 0) {
        const sd = await safeCall(rpc, () => erc4626.decimals()).then(Number);
        let total = 0n;
        for (const it of vault.sharesAtBlocks) {
            const shares = ethers.parseUnits(it.shares, sd);
            const assetsAtBlock = await safeCall(rpc, () => erc4626.convertToAssets(shares, { blockTag: it.block }));
            total += assetsAtBlock;
        }
        return total;
    }

    // manual assets
    if (typeof vault.manualAssetsIn === "string" && vault.manualAssetsIn.length > 0) {
        return ethers.parseUnits(vault.manualAssetsIn, assetDecimals);
    }

    return 0n;
}

/* ===================== Core calc ===================== */
// async function calcVaultPosition(vault: VaultCfg, wallet: string) {
//     const rpc = vault.rpc;
//     const provider = getProvider(rpc);
//     const erc4626 = new ethers.Contract(vault.address, ERC4626_ABI, provider);

//     // Underlying asset metadata
//     const assetAddr: string = await safeCall(rpc, () => erc4626.asset());
//     const asset = new ethers.Contract(assetAddr, ERC20_ABI, provider);
//     const [assetDecimals, assetSymbol] = await Promise.all([
//         safeCall(rpc, () => asset.decimals()).then(Number),
//         safeCall(rpc, () => asset.symbol()),
//     ]);

//     // Share decimals, wallet shares, current value
//     const shareDecimals = await safeCall(rpc, () => erc4626.decimals()).then(Number);
//     const walletShares: bigint = await safeCall(rpc, () => erc4626.balanceOf(wallet));
//     const currentAssets: bigint = await safeCall(rpc, () => erc4626.convertToAssets(walletShares));

//     // Cost basis: prefer receipts → fallback paths
//     let costBasisAssets: bigint = 0n;
//     try {
//         const fromReceipts = await costBasisFromReceipts(vault, wallet);
//         if (fromReceipts > 0n) {
//             costBasisAssets = fromReceipts;
//         } else {
//             costBasisAssets = await fallbackCostBasis(vault, assetDecimals);
//         }
//     } catch (e) {
//         console.warn(`[WARN] Cost basis via receipts failed for ${vault.address} on ${rpc}: ${(e as any)?.message ?? e}`);
//         costBasisAssets = await fallbackCostBasis(vault, assetDecimals);
//     }

//     const pnl = currentAssets - costBasisAssets;
//     const roi = costBasisAssets > 0n ? Number(pnl) / Number(costBasisAssets) : 0;

//     return {
//         assetSymbol, assetDecimals,
//         shareDecimals,
//         walletShares, currentAssets,
//         costBasisAssets,
//         pnl, roi,
//     };
// }

async function calcVaultPosition(vault: VaultCfg, wallet: string, blockTag: number) {
    const rpc = vault.rpc;
    const provider = getProvider(rpc);
    const erc4626 = new ethers.Contract(vault.address, ERC4626_ABI, provider);

    // Underlying asset metadata (can be unpinned; or pin if you prefer)
    const assetAddr: string = await safeCall(rpc, () => erc4626.asset());
    const asset = new ethers.Contract(assetAddr, ERC20_ABI, provider);
    const [assetDecimals, assetSymbol] = await Promise.all([
        safeCall(rpc, () => asset.decimals()).then(Number),
        safeCall(rpc, () => asset.symbol()),
    ]);

    // Share decimals (unchanging), then **pinned** shares & assets at blockTag
    const shareDecimals = await safeCall(rpc, () => erc4626.decimals()).then(Number);
    const { shares: walletShares, assets: currentAssets } =
        await readSharesAndAssetsAtBlock(vault.address, wallet, blockTag, rpc);

    // Cost basis (receipts already value at their own rcpt.blockNumber — keep as-is)
    let costBasisAssets: bigint = 0n;
    try {
        const fromReceipts = await costBasisFromReceipts(vault, wallet);
        costBasisAssets = fromReceipts > 0n ? fromReceipts : await fallbackCostBasis(vault, assetDecimals);
    } catch {
        costBasisAssets = await fallbackCostBasis(vault, assetDecimals);
    }

    const pnl = currentAssets - costBasisAssets;
    const roi = costBasisAssets > 0n ? Number(pnl) / Number(costBasisAssets) : 0;

    return { assetSymbol, assetDecimals, shareDecimals, walletShares, currentAssets, costBasisAssets, pnl, roi };
}



/* ===================== Strategy runner ===================== */
async function trackStrategy(strategy: StrategyCfg) {
    console.log(`\n=== ${strategy.name} ===`);
    const uniqueRpcs = Array.from(new Set(strategy.vaults.map(v => v.rpc)));
    const pinnedBlockByRpc: Record<string, number> = {};
    for (const rpc of uniqueRpcs) {
        pinnedBlockByRpc[rpc] = await safeCall(rpc, () => getProvider(rpc).getBlockNumber());
    }

    type Totals = { deposit: bigint; value: bigint; pnl: bigint; assetDecimals: number; assetSymbol: string; };
    const totalsByAsset: Record<string, Totals> = {};

    for (const v of strategy.vaults) {
        await sleep(350); // avoid bursty calls per provider
        const r = await calcVaultPosition(v, strategy.wallet, pinnedBlockByRpc[v.rpc]);

        console.log(`\n[${v.name}]`);

        if (r.costBasisAssets === 0n) {
            console.log(`Deposit: (unknown / not provided)`);
        } else {
            console.log(`Deposit: ${fmtUnits(r.costBasisAssets, r.assetDecimals)} ${r.assetSymbol}`);
        }
        console.log(`Current Value: ${fmtUnits(r.currentAssets, r.assetDecimals)} ${r.assetSymbol}`);
        console.log(`Shares: ${fmtUnits(r.walletShares, r.shareDecimals)} vault shares`);
        console.log(`PnL: ${fmtUnits(r.pnl, r.assetDecimals)} ${r.assetSymbol}`);
        console.log(`ROI: ${pct(r.roi)}`);

        const key = `${r.assetSymbol}:${r.assetDecimals}`;
        const t = totalsByAsset[key] ?? { deposit: 0n, value: 0n, pnl: 0n, assetDecimals: r.assetDecimals, assetSymbol: r.assetSymbol };
        t.deposit += r.costBasisAssets;
        t.value += r.currentAssets;
        t.pnl += r.pnl;
        totalsByAsset[key] = t;
    }

    for (const key of Object.keys(totalsByAsset)) {
        const t = totalsByAsset[key];
        const roi = t.deposit > 0n ? Number(t.pnl) / Number(t.deposit) : 0;
        console.log(`\n--- Total for ${strategy.name} [${t.assetSymbol}] ---`);
        if (t.deposit === 0n) console.log(`Total Deposit: (unknown / not provided)`);
        else console.log(`Total Deposit: ${fmtUnits(t.deposit, t.assetDecimals)} ${t.assetSymbol}`);
        console.log(`Total Value: ${fmtUnits(t.value, t.assetDecimals)} ${t.assetSymbol}`);
        console.log(`Total PnL: ${fmtUnits(t.pnl, t.assetDecimals)} ${t.assetSymbol}`);
        console.log(`Total ROI: ${pct(roi)}`);
    }
}

/* ===================== MAIN ===================== */
(async () => {
    for (const s of STRATEGIES) {
        await trackStrategy(s);
    }
})().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
});
