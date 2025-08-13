// file: bridge-usdc-compare-fixed.ts
import { ethers } from "ethers";

// ===== RPC + pricing knobs =====
const PROVIDER_BASE = new ethers.JsonRpcProvider("https://mainnet.base.org");
const ETH_PRICE_USDC = 3000;             // update to current
const USE_PROVIDER_GAS_PRICE = true;
const GAS_PRICE_GWEI_FALLBACK = 0.1;

// ===== Chains / tokens =====
const CHAIN_BASE = 8453;
const CHAIN_ARB = 42161;

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_ARB = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const FROM_ADDRESS = "0x688a38F2AA707f087cb67E92DeD8c3Bdbaa73A4e";  // the wallet that holds the USDC on source chain
const TO_ADDRESS = "0x688a38F2AA707f087cb67E92DeD8c3Bdbaa73A4e";  // typically same as from, can be different
// ===== Helpers =====
const gweiToWei = (g: number) => ethers.parseUnits(g.toString(), "gwei");
const weiToEth = (w: ethers.BigNumberish) => Number(ethers.formatEther(w));
const fmt6 = (n: number) => n.toFixed(6);

async function getGasPriceWei() {
    if (USE_PROVIDER_GAS_PRICE) {
        const feeData = await PROVIDER_BASE.getFeeData();
        return feeData.gasPrice || gweiToWei(GAS_PRICE_GWEI_FALLBACK);
    }
    return gweiToWei(GAS_PRICE_GWEI_FALLBACK);
}

type Q = { name: string; grossOut: number; amountOutRaw: string; gasUnits: number; routeSummary?: string };

function withGas(q: Q, gasPriceWei: bigint) {
    const gasETH = weiToEth(gasPriceWei * BigInt(Math.max(q.gasUnits || 0, 0)));
    const gasUSDC = gasETH * ETH_PRICE_USDC;
    return { ...q, gasETH, gasUSDC, netOut: q.grossOut - gasUSDC };
}

// =================== QUOTERS ===================

// 1) Skip — correct endpoint: /v2/fungible/route  (works for EVM↔EVM and EVM↔Solana)
async function quoteSkip_USDC(params: {
    srcChainId: string; srcDenom: string;
    dstChainId: string; dstDenom: string;
    amountInRaw: string; smartRelay?: boolean;
}) {
    const url = "https://api.skip.build/v2/fungible/route";
    const body: any = {
        amount_in: params.amountInRaw,
        source_asset_denom: params.srcDenom,
        source_asset_chain_id: params.srcChainId,
        dest_asset_denom: params.dstDenom,
        dest_asset_chain_id: params.dstChainId,
        // smart_relay: params.smartRelay ?? (params.dstChainId === "solana"),
        smart_relay: true,
        allow_multi_tx: true, // <-- helps unlock more EVM↔EVM paths
    };
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (process.env.SKIP_API_KEY) headers["x-api-key"] = process.env.SKIP_API_KEY;

    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Skip /v2/fungible/route ${res.status}: ${await res.text()}`);
    const data = await res.json();

    const amountOutRaw = data?.amount_out;
    const operations = (data?.operations ?? []) as any[];
    const routeSummary = operations.map((op: any) => {
        if (op?.cctp_transfer) return "bridge:CCTP";
        if (op?.axelar_transfer) return `bridge:${op.axelar_transfer.bridge_id || "AXELAR"}`;
        if (op?.swap) return `swap:${op.swap?.swap_in?.swap_venue?.name || "swap"}`;
        return Object.keys(op)[0] || "step";
    }).join(" → ");

    return {
        name: "skip",
        grossOut: Number(ethers.formatUnits(amountOutRaw, 6)),
        amountOutRaw,
        gasUnits: Number(data?.evm_tx?.gas ?? 0),
        routeSummary,
        meta: data,
    };
}
// Docs: POST /v2/fungible/route, ecosystems, Smart Relay. (See citations below)

// 2) LI.FI — good for EVM↔EVM compare
async function quoteLiFi_USDC(fromChainId: number, toChainId: number, amountRaw: string) {
    const qs = new URLSearchParams({
        fromChain: String(fromChainId),
        toChain: String(toChainId),
        fromToken: fromChainId === CHAIN_BASE ? USDC_BASE : USDC_ARB,
        toToken: toChainId === CHAIN_BASE ? USDC_BASE : USDC_ARB,
        fromAmount: amountRaw,
        fromAddress: FROM_ADDRESS,   // <-- required
        toAddress: TO_ADDRESS,     // <-- recommended (lets LI.FI build calldata)
    });
    const url = `https://li.quest/v1/quote?${qs}`;
    const res = await fetch(url, {
        headers: {
            "accept": "application/json",
            ...(process.env.LIFI_API_KEY ? { "x-lifi-api-key": process.env.LIFI_API_KEY } : {}),
        }
    });
    if (!res.ok) throw new Error(`LI.FI /quote ${res.status}: ${await res.text()}`);
    const data = await res.json();

    const est = data?.estimate;
    const toAmount = est?.toAmount;
    const gasUnits = Number(est?.gasCosts?.[0]?.estimate ?? 0);
    const routeSummary = (data?.tools ?? []).join("+");

    return {
        name: "lifi",
        grossOut: Number(ethers.formatUnits(toAmount, 6)),
        amountOutRaw: toAmount,
        gasUnits,
        routeSummary,
        meta: data,
    };
}

async function quoteSocket_USDC(fromChainId: number, toChainId: number, amountRaw: string) {
    const qs = new URLSearchParams({
        fromChainId: String(fromChainId),
        toChainId: String(toChainId),
        fromTokenAddress: fromChainId === CHAIN_BASE ? USDC_BASE : USDC_ARB,
        toTokenAddress: toChainId === CHAIN_BASE ? USDC_BASE : USDC_ARB,
        amount: amountRaw,
        uniqueRoutesPerBridge: "true",
        sort: "output",
        singleTxOnly: "true"
    });
    const url = `https://api.socket.tech/v2/quote?${qs}`;
    const headers: Record<string, string> = { accept: "application/json" };
    if (process.env.SOCKET_API_KEY) {
        // Socket accepts an API key header; check your dashboard for the exact header name.
        headers["API-KEY"] = process.env.SOCKET_API_KEY; // sometimes "X-API-Key"
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`Socket /quote ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const route = data?.result?.routes?.[0];
    const toAmount = route?.toAmount;
    const routeSummary = (route?.steps ?? [])
        .map((s: any) => s?.protocol || s?.bridgeName)
        .filter(Boolean).join(" → ");

    return {
        name: "socket",
        grossOut: Number(ethers.formatUnits(toAmount, 6)),
        amountOutRaw: toAmount,
        gasUnits: 0, // Socket often doesn't surface units in quote; leave 0 to avoid fake gas
        routeSummary,
        meta: data,
    };
}

// =================== RUN FOUR ROUTES ===================
(async () => {
    try {
        const amountHuman = "10000"; // 10k USDC
        const amountRaw = ethers.parseUnits(amountHuman, 6).toString();
        const gasPriceWei = await getGasPriceWei();

        const pairs = [
            { label: "Base → Arbitrum", srcChainId: String(CHAIN_BASE), dstChainId: String(CHAIN_ARB), srcDenom: USDC_BASE, dstDenom: USDC_ARB },
            { label: "Base → Solana", srcChainId: String(CHAIN_BASE), dstChainId: "solana", srcDenom: USDC_BASE, dstDenom: USDC_SOL },
            { label: "Arbitrum → Base", srcChainId: String(CHAIN_ARB), dstChainId: String(CHAIN_BASE), srcDenom: USDC_ARB, dstDenom: USDC_BASE },
            { label: "Arbitrum → Solana", srcChainId: String(CHAIN_ARB), dstChainId: "solana", srcDenom: USDC_ARB, dstDenom: USDC_SOL },
        ];

        for (const p of pairs) {
            console.log(`\n=== ${p.label} (USDC native via CCTP) ===`);
            const quotes: Q[] = [];

            // Skip (primary)
            const skipRes = await quoteSkip_USDC({
                srcChainId: p.srcChainId, srcDenom: p.srcDenom,
                dstChainId: p.dstChainId, dstDenom: p.dstDenom,
                amountInRaw: amountRaw,
            }).catch(e => ({ error: e.message })) as any;

            if (!skipRes?.error) quotes.push(skipRes);
            else console.log(`skip (error): ${skipRes.error}`);


            const enriched = quotes.map(q => withGas(q, gasPriceWei));
            if (!enriched.length) { console.log("No quotes."); continue; }

            // Sort and print
            const byNet = [...enriched].sort((a, b) => b.netOut - a.netOut);
            const pad = (s: any, n: number) => String(s).padEnd(n);
            const fmt = (n?: number) => (n == null ? "-" : n.toFixed(6));

            console.log(pad("Router", 10), pad("GrossOut", 14), pad("Gas(USDC)", 12), pad("NetOut", 14), "Route");
            for (const q of enriched) {
                console.log(
                    pad(q.name, 10),
                    pad(fmt(q.grossOut), 14),
                    pad(fmt(q.gasUSDC), 12),
                    pad(fmt(q.netOut), 14),
                    q.routeSummary || "-"
                );
            }
            const best = byNet[0];
            console.log(`Best by NET: ${best.name} (${fmt(best.netOut)} USDC)`);
        }
    } catch (e: any) {
        console.error("Fatal:", e?.message || e);
    }
})();
