// import { ethers } from "ethers";
// import fetch from "node-fetch";
// import { AlphaRouter, SwapType } from "@uniswap/smart-order-router";
// import { Token, CurrencyAmount, TradeType, Percent } from "@uniswap/sdk-core";

// const RPC = "https://mainnet.base.org";
// const provider = new ethers.providers.JsonRpcProvider(RPC);

// const CHAIN_ID = 8453; // Base
// const USDC = new Token(CHAIN_ID, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6, "USDC", "USD Coin");
// const USDT = new Token(CHAIN_ID, "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", 6, "USDT", "Tether USD");

// async function quoteUniswapUSDCtoUSDT(amountUsdcRaw: string) {
//     const router = new AlphaRouter({ chainId: CHAIN_ID, provider });

//     const amountIn = CurrencyAmount.fromRawAmount(USDC, amountUsdcRaw);

//     const route = await router.route(
//         amountIn,
//         USDT,
//         TradeType.EXACT_INPUT,
//         {
//             type: SwapType.SWAP_ROUTER_02, // ✅ Correct enum usage
//             recipient: ethers.constants.AddressZero,
//             slippageTolerance: new Percent(5, 10_000), // 0.05%
//             deadline: Math.floor(Date.now() / 1000) + 1800,
//         }
//     );

//     if (!route) throw new Error("Uniswap: no route found");

//     const quoteRaw = route.quote.quotient.toString();
//     return {
//         dex: "uniswap",
//         amountOutRaw: quoteRaw,
//         amountOut: ethers.utils.formatUnits(quoteRaw, 6),
//         gasEstimate: route.estimatedGasUsed.toString(),
//         routeSummary: route.route[0]?.tokenPath.map(token => token.symbol).join(" → ") ?? "multi"

//     };
// }

// // ---------- ParaSwap (API v5) ----------
// async function quoteParaswapUSDCtoUSDT(amountUsdcRaw: string) {
//     const qs = new URLSearchParams({
//         srcToken: USDC.address,
//         destToken: USDT.address,
//         amount: amountUsdcRaw,          // raw units
//         srcDecimals: "6",
//         destDecimals: "6",
//         side: "SELL",
//         network: String(CHAIN_ID),      // 8453
//     });
//     const url = `https:/
//     /prices?${qs.toString()}`;
//     const res = await fetch(url, { headers: { "Accept": "application/json" } });
//     if (!res.ok) throw new Error(`ParaSwap error: ${res.status} ${await res.text()}`);
//     const data = await res.json();
//     const out = data?.priceRoute?.destAmount ?? null;
//     if (!out) throw new Error("ParaSwap: no quote");
//     return {
//         dex: "paraswap",
//         amountOutRaw: out,
//         amountOut: ethers.utils.formatUnits(out, 6),
//         gasEstimate: data?.priceRoute?.gasCost ?? null,
//         routeSummary: (data?.priceRoute?.bestRoute ?? [])
//             .map((leg: any) => leg.swaps?.map((s: any) => s.srcTokenSymbol + "→" + s.destTokenSymbol).join(","))
//             .filter(Boolean).join(" | "),
//     };
// }

// // ---------- KyberSwap Aggregator (API v1 GET) ----------
// async function quoteKyberUSDCtoUSDT(amountUsdcRaw: string) {
//     // GET route summary
//     const url = `https://aggregator-api.kyberswap.com/base/api/v1/routes?` +
//         new URLSearchParams({
//             tokenIn: USDC.address,
//             tokenOut: USDT.address,
//             amountIn: amountUsdcRaw,       // raw units
//             saveGas: "true",
//         }).toString();

//     const res = await fetch(url, { headers: { "Accept": "application/json" } });
//     if (!res.ok) throw new Error(`Kyber error: ${res.status} ${await res.text()}`);
//     const data = await res.json();
//     const out = data?.data?.routeSummary?.amountOut ?? null;
//     if (!out) throw new Error("Kyber: no quote");
//     return {
//         dex: "kyberswap",
//         amountOutRaw: out,
//         amountOut: ethers.utils.formatUnits(out, 6),
//         gasEstimate: data?.data?.routeSummary?.gas ?? null,
//         routeSummary: (data?.data?.routeSummary?.route ?? [])
//             .map((r: any) => (r?.dexes ?? []).map((d: any) => d.dex?.name).join("+")).join(" → "),
//     };
// }

// // ---------- One call to compare all ----------
// export async function quoteAllUSDCtoUSDT_Base(amountUsdc: string) {
//     const amountRaw = ethers.utils.parseUnits(amountUsdc, 6).toString();
//     const [uni, para, kyber] = await Promise.all([
//         quoteUniswapUSDCtoUSDT(amountRaw).catch(e => ({ dex: "uniswap", error: e.message })),
//         quoteParaswapUSDCtoUSDT(amountRaw).catch(e => ({ dex: "paraswap", error: e.message })),
//         quoteKyberUSDCtoUSDT(amountRaw).catch(e => ({ dex: "kyberswap", error: e.message })),
//     ]);
//     return [uni, para, kyber];
// }

// // Example:
// quoteAllUSDCtoUSDT_Base("10000000000").then(console.log).catch(console.error);
// file: quote-base-usdc-usdt.ts
// 

import { ethers } from "ethers";

// If you're on Node 18+, global fetch exists. If not, uncomment:
// // @ts-ignore
// import fetch from "node-fetch";

import { AlphaRouter, SwapType } from "@uniswap/smart-order-router";
import { Token, CurrencyAmount, TradeType, Percent } from "@uniswap/sdk-core";
const KYBER_HEADERS = { "Accept": "application/json", "X-Client-Id": "MyAwesomeApp" };
const RPC = "https://mainnet.base.org";
const provider = new ethers.providers.JsonRpcProvider(RPC);
const CHAIN_ID = 8453;

// ===== knobs you may tweak =====
const ETH_PRICE_USDC = 4600;             // <-- update this to current ETH price on Base
const USE_PROVIDER_GAS_PRICE = true;     // true = provider.getGasPrice(); false = use GAS_PRICE_GWEI
const GAS_PRICE_GWEI = 0.1;              // used if USE_PROVIDER_GAS_PRICE = false

// Base token addresses (6 decimals each)
const USDC = new Token(CHAIN_ID, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", 6, "USDC", "USD Coin");
const USDT = new Token(CHAIN_ID, "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", 6, "USDT", "Tether USD");

// ---------- Uniswap ----------
async function quoteUniswap(amountUsdcRaw: string) {
    const router = new AlphaRouter({ chainId: CHAIN_ID, provider });
    const amountIn = CurrencyAmount.fromRawAmount(USDC, amountUsdcRaw);

    const route = await router.route(amountIn, USDT, TradeType.EXACT_INPUT, {
        type: SwapType.SWAP_ROUTER_02,
        recipient: "0x688a38F2AA707f087cb67E92DeD8c3Bdbaa73A4e",
        slippageTolerance: new Percent(5, 10_000),
        deadline: Math.floor(Date.now() / 1000) + 1800,
    });

    if (!route) throw new Error("Uniswap: no route found");

    const quoteRaw = route.quote.quotient.toString();
    return {
        dex: "uniswap",
        amountOutRaw: quoteRaw,
        amountOut: Number(ethers.utils.formatUnits(quoteRaw, 6)),
        gasUnits: Number(route.estimatedGasUsed?.toString() ?? "0"),
        routeSummary:
            route.route?.[0]?.tokenPath?.map((t: any) => t.symbol).join(" → ")
            ?? route.route?.[0]?.tokenPath?.map((t: any) => t.symbol).join(" → ")
            ?? "multi",
    };
}

// ---------- ParaSwap (v6.2) ----------
async function quoteParaswap(amountRaw: string) {
    const url = `https://api.paraswap.io/prices?` + new URLSearchParams({
        srcToken: USDC.address,
        destToken: USDT.address,
        amount: amountRaw,
        srcDecimals: "6",
        destDecimals: "6",
        side: "SELL",
        network: String(CHAIN_ID),
    }).toString();

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`ParaSwap /prices ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const pr = data?.priceRoute;
    const destAmount = pr?.destAmount;
    if (!destAmount) throw new Error("ParaSwap: no destAmount in response");

    return {
        dex: "paraswap",
        amountOutRaw: destAmount,
        amountOut: Number(ethers.utils.formatUnits(destAmount, 6)),
        gasUnits: Number(pr?.gasCost ?? 0), // gas units (not wei)
        routeSummary: (pr?.bestRoute ?? [])
            .map((leg: any) => (leg?.swaps ?? [])
                .map((s: any) => (s?.swapExchanges ?? []).map((x: any) => x.exchange).join("+"))
                .filter(Boolean).join(" | "))
            .filter(Boolean).join(" → "),
    };
}

// ---------- KyberSwap ----------

async function quoteKyber(amountRaw: string) {
    const url = `https://aggregator-api.kyberswap.com/base/api/v1/routes?` + new URLSearchParams({
        tokenIn: USDC.address,
        tokenOut: USDT.address,
        amountIn: amountRaw,
        saveGas: "true",
    }).toString();

    const res = await fetch(url, { headers: KYBER_HEADERS });
    if (!res.ok) throw new Error(`Kyber HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const summary = data?.data?.routeSummary;
    const out = summary?.amountOut;
    if (!out) throw new Error("Kyber: no amountOut in response");
    const routeSummaryPretty = (() => {
        const route = summary?.route ?? [];
        // v1 shape: route is an array of "paths"; each path is an array of legs
        // leg.exchange is the human-friendly DEX id; fallbacks added just in case
        const paths = route.map((path: any[]) =>
            path
                .map((leg: any) =>
                    leg?.exchange ||
                    leg?.dex?.name ||           // legacy fallback
                    leg?.poolType ||            // another fallback
                    "?"
                )
                .filter(Boolean)
                .join(" → ")
        );
        return paths.join(" || ");
    })();
    // Kyber sometimes returns gas as string; treat as units
    const gasUnits = Number(summary?.gas ?? 0);

    return {
        dex: "kyberswap",
        amountOutRaw: out,
        amountOut: Number(ethers.utils.formatUnits(out, 6)),
        gasUnits,
        routeSummary: routeSummaryPretty,
    };
}

// ---------- helpers ----------
function gweiToWei(gwei: number) {
    return ethers.utils.parseUnits(gwei.toString(), "gwei");
}
function weiToEth(wei: ethers.BigNumberish) {
    return Number(ethers.utils.formatEther(wei));
}

type Quote = {
    dex: string;
    amountOut: number;   // USDT
    amountOutRaw: string;
    gasUnits: number;    // units
    routeSummary?: string;
};

async function getGasPriceWei(): Promise<ethers.BigNumber> {
    if (USE_PROVIDER_GAS_PRICE) {
        return await provider.getGasPrice(); // wei
    } else {
        return gweiToWei(GAS_PRICE_GWEI);    // wei
    }
}

function computeNet(
    q: Quote,
    gasPriceWei: ethers.BigNumber,
    ethPriceUSDC: number
) {
    const gasCostWei = gasPriceWei.mul(Math.max(q.gasUnits || 0, 0));
    const gasCostETH = weiToEth(gasCostWei);
    const gasCostUSDC = gasCostETH * ethPriceUSDC;

    // Since USDT ~ USDC, treat gas cost in USDC as USDT cost (netOut = out - gasCostUSDC)
    const netOut = q.amountOut - gasCostUSDC;

    return { ...q, gasCostETH, gasCostUSDC, netOut };
}

// ---- Run it ----
(async () => {
    try {
        console.log("Starting quotes on Base…");
        const amountHuman = "1000"; // e.g., 10,000 USDC
        const amountRaw = ethers.utils.parseUnits(amountHuman, 6).toString();

        const gasPriceWei = await getGasPriceWei();

        const results = await Promise.allSettled([
            // quoteUniswap(amountRaw),
            // quoteParaswap(amountRaw),
            quoteKyber(amountRaw),
        ]);

        const quotes: Quote[] = results
            .map(r => (r.status === "fulfilled" ? r.value : null))
            .filter(Boolean) as Quote[];

        const enriched = quotes.map(q => computeNet(q, gasPriceWei, ETH_PRICE_USDC));

        // sort by gross and by net
        const byGross = [...enriched].sort((a, b) => b.amountOut - a.amountOut);
        const byNet = [...enriched].sort((a, b) => b.netOut - a.netOut);

        // pretty print
        const pad = (s: any, n: number) => String(s).padEnd(n);
        const fmt = (n?: number) => (n == null ? "-" : n.toFixed(6));

        console.log("\nGas price (wei):", gasPriceWei.toString(), "| (gwei):", weiToEth(gasPriceWei) * 1e9);
        console.log("ETH price (USDC):", ETH_PRICE_USDC, "\n");

        console.log(pad("DEX", 12), pad("GrossOut(USDT)", 18), pad("GasUnits", 10), pad("Gas(ETH)", 12), pad("Gas(USDC)", 12), pad("NetOut(USDT)", 16));
        for (const q of enriched) {
            console.log(
                pad(q.dex, 12),
                pad(fmt(q.amountOut), 18),
                pad(q.gasUnits ?? "-", 10),
                pad(fmt(q.gasCostETH), 12),
                pad(fmt(q.gasCostUSDC), 12),
                pad(fmt(q.netOut), 16),
            );
        }

        const winnerGross = byGross[0];
        const winnerNet = byNet[0];

        console.log("\nBest by GROSS amount out:", winnerGross.dex, `(${winnerGross.amountOut.toFixed(6)} USDT)`);
        console.log("Best by NET after gas   :", winnerNet.dex, `(${winnerNet.netOut.toFixed(6)} USDT)`);

        console.log("\nRoute hints:");
        enriched.forEach(q => {
            console.log(`- ${q.dex}: ${q.routeSummary ?? "(no summary)"}`);
        });

    } catch (e: any) {
        console.error("Fatal error:", e?.message ?? e);
    }
})();
