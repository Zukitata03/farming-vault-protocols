import { ethers } from "ethers";
import dotenv from "dotenv";
import { erc20Abi } from "viem";
import { getAddressFromMnemonicEthers } from "./contractInteractor";
import { getWallet } from "../utils/walletHelper";
dotenv.config();
const KYBER_CLIENT_ID = process.env.KYBER_CLIENT_ID || "Swap";
type Network = "base" | "arbitrum";
import { formatUnits, parseUnits } from "ethers";

// Chainlink ETH/USD price feed on Ethereum Mainnet
const PRICE_FEED_ADDRESS = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";
const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
const KYBER_HEADERS = { "Accept": "application/json", "X-Client-Id": "SwapAggregator" };
type SwapOpts = {
    network?: Network;
    recipient?: string;
    slippage?: number; // 5 = 0.05%
    useProviderGasPrice?: boolean;
    manualGasPriceWei?: number; //if useProviderGasPrice is false
    logger?: (msg: string) => void;
    ethPriceUsd?: number;
}
const aggregatorV3InterfaceABI = [
    {
        inputs: [],
        name: "latestRoundData",
        outputs: [
            { internalType: "uint80", name: "roundId", type: "uint80" },
            { internalType: "int256", name: "answer", type: "int256" },
            { internalType: "uint256", name: "startedAt", type: "uint256" },
            { internalType: "uint256", name: "updatedAt", type: "uint256" },
            { internalType: "uint80", name: "answeredInRound", type: "uint80" }
        ],
        stateMutability: "view",
        type: "function"
    }
];

// =================== CHAINS ===================
const CHAINS: Record<Network, {
    rpc: string;
    chainId: number;
    kyberPath: string;
}> = {
    base: {
        rpc: "https://mainnet.base.org",
        chainId: 8453,
        kyberPath: "base",
    },
    arbitrum: {
        rpc: "https://arb1.arbitrum.io/rpc",
        chainId: 42161,
        kyberPath: "arbitrum",
    },
};

// ======================== TOKEN ADDRESSES ========================
const TOKEN_REGISTRY: Record<Network, Record<string, string>> = {
    arbitrum: {
        usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        usdt: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        dai: "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1",
        weth: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    },
    base: {
        usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        usdt: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
        dai: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
        weth: "0x4200000000000000000000000000000000000006",
    },
};

// ===================== Small utils =====================
const toChecksum = (addr: string) => ethers.getAddress(addr);
const isAddress = (s: string) => {
    try { ethers.getAddress(s); return true; } catch { return false; }
};
const gweiToWei = (g: number) => ethers.parseUnits(String(g), "gwei");
const weiToEth = (w: ethers.BigNumberish) => Number(ethers.formatEther(w));

async function getDecimals(provider: ethers.Provider, token: string): Promise<number> {
    const erc20 = new ethers.Contract(token, erc20Abi, provider);
    const d = await erc20.decimals();
    return typeof d === "bigint" ? Number(d) : Number(d);
}

async function getEthPrice() {
    const priceFeed = new ethers.Contract(PRICE_FEED_ADDRESS, aggregatorV3InterfaceABI, provider);
    const roundData = await priceFeed.latestRoundData();
    const price = roundData[1]; // ETH/USD with 8 decimals

    console.log(`Current ETH Price: $${ethers.formatUnits(price, 8)}`);
    return ethers.formatUnits(price, 8);
}




function toFixedSafe(val: bigint | number | string, decimals: number | bigint): string {
    try {
        const dec = typeof decimals === "bigint" ? Number(decimals) : decimals;

        if (typeof val === "bigint") {
            return ethers.formatUnits(val, dec);
        }

        if (typeof val === "string" && /^\d+$/.test(val)) {
            return ethers.formatUnits(BigInt(val), dec);
        }

        const num = Number(val);
        if (!isFinite(num)) return "NaN";
        return num.toFixed(dec);
    } catch (err) {
        console.error(`toFixedSafe error:`, err, val);
        return "NaN";
    }
}



async function ensureAllowance(
    token: string,
    owner: string,
    spender: string,
    amount: bigint,
    signer: ethers.Signer,
    log: (m: string) => void
) {
    const erc20 = new ethers.Contract(token, erc20Abi, signer);
    const current: bigint = await erc20.allowance(owner, spender);
    if (current >= amount) return;
    const tx = await erc20.approve(spender, amount);
    log(`→ approve ${spender} for ${amount.toString()} (tx: ${tx.hash})`);
    await tx.wait();
    log(`✔ approve confirmed`);
}

async function gasPriceWei(
    provider: ethers.JsonRpcProvider,
    useProvider: boolean,
    manualGwei?: number,
    ethPriceUsd?: number
): Promise<bigint> {
    if (useProvider) {
        const fd = await provider.getFeeData();
        return BigInt(fd.gasPrice?.toString() ?? "0");
    }
    return gweiToWei(manualGwei ?? 0.1);
}



// ====================Quotes======================
type Quote = {
    dex: "paraswap" | "kyberswap";
    amountOutRaw: string;
    amountOut: number;
    gasUnits: number;
    routeSummary?: string;
    raw?: any;         // aggregator-specific payload used to build
    spender?: string;  // spender/router to approve
};



// ===================Paraswap======================
async function quoteParaswap(
    chainId: number,
    srcToken: string,
    dstToken: string,
    srcDecimals: number,
    dstDecimals: number,
    amountRaw: string
): Promise<Quote> {
    const url = `https://api.paraswap.io/prices?` + new URLSearchParams({
        srcToken,
        destToken: dstToken,
        amount: amountRaw,
        srcDecimals: String(srcDecimals),
        destDecimals: String(dstDecimals),
        side: "SELL",
        network: String(chainId),
    }).toString();
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`ParaSwap /prices ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const pr = data?.priceRoute;
    const destAmount = pr?.destAmount;
    if (!destAmount) throw new Error("ParaSwap: no destAmount");
    const routeSummary =
        (pr?.bestRoute ?? [])
            .map((leg: any) =>
                (leg?.swaps ?? [])
                    .map((s: any) => (s?.swapExchanges ?? []).map((x: any) => x.exchange).join("+"))
                    .filter(Boolean).join(" | ")
            )
            .filter(Boolean).join(" → ");
    const spender = pr?.tokenTransferProxy || pr?.spender || pr?.augustus;
    return {
        dex: "paraswap",
        amountOutRaw: destAmount,
        amountOut: Number(ethers.formatUnits(destAmount, dstDecimals)),
        gasUnits: Number(pr?.gasCost ?? 0),
        routeSummary,
        raw: pr,
        spender,
    };
}

async function buildParaswapTx(
    chainId: number,
    params: {
        srcToken: string; destToken: string;
        srcAmount: string; destAmount: string;
        priceRoute: any; userAddress: string;
        slippagePct: number; partner?: string;
    }
): Promise<{ to: string; data: string; value: string }> {
    const url = `https://api.paraswap.io/transactions/${chainId}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
            srcToken: params.srcToken,
            destToken: params.destToken,
            srcAmount: params.srcAmount,
            destAmount: params.destAmount,
            userAddress: params.userAddress,
            priceRoute: params.priceRoute,
            slippage: params.slippagePct,         // e.g., 0.5
            partner: params.partner ?? "myapp",
        }),
    });
    if (!res.ok) throw new Error(`ParaSwap /transactions ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const tx = data?.data;
    if (!tx?.to || !tx?.data) throw new Error("ParaSwap build: malformed tx");
    return { to: tx.to, data: tx.data, value: String(tx.value ?? "0") };
}


// ===================Kyberswap======================


async function quoteKyber(
    kyberPath: string,
    srcToken: string,
    dstToken: string,
    amountRaw: string,
    dstDecimals: number
): Promise<Quote> {
    const url = `https://aggregator-api.kyberswap.com/${kyberPath}/api/v1/routes?` + new URLSearchParams({
        tokenIn: srcToken,
        tokenOut: dstToken,
        amountIn: amountRaw,
        saveGas: "true",
    }).toString();
    const res = await fetch(url, { headers: { Accept: "application/json", "X-Client-Id": KYBER_CLIENT_ID } });
    if (!res.ok) throw new Error(`Kyber /routes ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const summary = data?.data?.routeSummary;
    const out = summary?.amountOut;
    if (!out) throw new Error("Kyber: no amountOut");
    const gasUnits = Number(summary?.gas ?? 0);
    const routeSummary = (summary?.route ?? [])
        .map((path: any[]) => path
            .map((leg: any) => leg?.exchange || leg?.dex?.name || leg?.poolType || "?")
            .filter(Boolean).join(" → "))
        .join(" || ");
    const spenderGuess = data?.data?.routerAddress || data?.data?.routerAddressV2;
    return {
        dex: "kyberswap",
        amountOutRaw: out,
        amountOut: Number(ethers.formatUnits(out, dstDecimals)),
        gasUnits,
        routeSummary,
        raw: summary,
        spender: spenderGuess || undefined,
    };
}

async function buildKyberTx(
    kyberPath: string,
    params: { routeSummary: any; sender: string; recipient: string; slippageBps: number; }
): Promise<{ to: string; data: string; value: string; routerAddress?: string }> {
    const url = `https://aggregator-api.kyberswap.com/${kyberPath}/api/v1/route/build`;
    const res = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-Client-Id": KYBER_CLIENT_ID },
        body: JSON.stringify({
            routeSummary: params.routeSummary,
            sender: params.sender,
            recipient: params.recipient,
            slippageTolerance: params.slippageBps,     // BPS
            deadline: Math.floor(Date.now() / 1000) + 1800,
            skipSimulate: true,
        }),
    });
    if (!res.ok) throw new Error(`Kyber /route/build ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const tx = data?.data;
    if (!tx?.to || !tx?.data) throw new Error("Kyber build: malformed tx");
    return {
        to: tx.to,
        data: tx.data,
        value: String(tx.value ?? "0"),
        routerAddress: data?.data?.routerAddress,
    };
}




// ===================== Core: swap() =====================
export async function swap(
    tokenIn: string,     // symbol or address
    tokenOut: string,    // symbol or address
    amountHuman: string, // "0.1" means 0.1 of tokenIn
    opts: SwapOpts = {}
) {
    const log = opts.logger ?? console.log;

    // -------- Network / Wallet / Provider --------
    const network: Network = opts.network ?? "arbitrum";
    const chain = CHAINS[network];
    if (!process.env.MNEMONIC_BASE) throw new Error("Set MNEMONIC_BASE env var");
    const provider = new ethers.JsonRpcProvider(chain.rpc);
    const ctx = { network, mnemonic: process.env.MNEMONIC_BASE };
    const sender = getAddressFromMnemonicEthers(ctx);
    const recipient = opts.recipient || sender;
    const wallet = getWallet(process.env.MNEMONIC_BASE!, provider);

    log(`Network: ${network} (chainId=${chain.chainId})`);
    log(`Sender : ${sender}`);
    log(`Recipient: ${recipient}`);

    // -------- Resolve tokens (symbol or address) --------
    function resolveToken(id: string): string {
        const key = id.toLowerCase();
        if (isAddress(key)) return toChecksum(key);
        const reg = TOKEN_REGISTRY[network];
        const addr = reg[key];
        if (!addr) throw new Error(`Unknown token "${id}" on ${network}. Add it to TOKEN_REGISTRY or pass address.`);
        return toChecksum(addr);
    }
    const srcToken = resolveToken(tokenIn);
    const dstToken = resolveToken(tokenOut);
    if (srcToken === dstToken) throw new Error("tokenIn and tokenOut are the same");

    // -------- Decimals & amount parsing --------
    const srcDecimals = await getDecimals(provider, srcToken);
    const dstDecimals = await getDecimals(provider, dstToken);
    const srcAmountRaw = ethers.parseUnits(amountHuman, srcDecimals).toString();

    // -------- Gas price for net calc --------
    const gasPrice = await gasPriceWei(
        provider,
        opts.useProviderGasPrice ?? true,
        opts.manualGasPriceWei,
        opts.ethPriceUsd
    );
    const ethPriceUsd = opts.ethPriceUsd ?? await getEthPrice();
    console.log("test", ethPriceUsd);

    const netCalc = (q: Quote) => {
        const gasCostWei = gasPrice * BigInt(Math.max(q.gasUnits || 0, 0));
        const gasEth = weiToEth(gasCostWei);
        const gasUsd = Number(gasEth) * Number(ethPriceUsd);
        const net = q.amountOut - gasUsd; // treat 1 USDT ≈ 1 USD for ranking
        return { ...q, gasUsd, netOut: net };
    };

    // -------- Fetch quotes in parallel --------
    log(`Quoting… ${tokenIn} -> ${tokenOut} amount ${amountHuman}`);
    const [ps, ky] = await Promise.allSettled([
        quoteParaswap(chain.chainId, srcToken, dstToken, srcDecimals, dstDecimals, srcAmountRaw),
        quoteKyber(chain.kyberPath, srcToken, dstToken, srcAmountRaw, dstDecimals),
    ]);
    const quotes: Quote[] = [ps, ky].map(r => (r.status === "fulfilled" ? r.value as Quote : null)).filter(Boolean) as Quote[];
    if (!quotes.length) throw new Error("Both quotes failed");

    const ranked = quotes.map(netCalc).sort((a, b) => b.netOut - a.netOut);
    console.log(ranked);
    for (const q of ranked) {
        log(`${q.dex.padEnd(9)} | gross=${toFixedSafe(q.amountOut, dstDecimals)}  gas(USD)=${toFixedSafe(q.gasUsd, 6)}  net=${toFixedSafe(q.netOut, 6)}  ${q.routeSummary ? `| ${q.routeSummary}` : ""}`);
    }
    const winner = ranked[0];
    log(`Winner: ${winner.dex} (net ${toFixedSafe(winner.netOut, 6)})`);

    // -------- Execute the winner --------
    const slippageBps = opts.slippage ?? 50; // 0.50%

    if (winner.dex === "paraswap") {
        const pr = winner.raw; // priceRoute
        const spender = winner.spender || pr?.tokenTransferProxy || pr?.spender || pr?.augustus;
        if (!spender) throw new Error("ParaSwap: missing spender in priceRoute");

        await ensureAllowance(srcToken, sender, spender, BigInt(srcAmountRaw), wallet, log);

        // ParaSwap slippage is in PERCENT (e.g., 0.5)
        const slippagePct = slippageBps / 100;

        const built = await buildParaswapTx(chain.chainId, {
            srcToken, destToken: dstToken,
            srcAmount: srcAmountRaw,
            destAmount: winner.amountOutRaw,
            priceRoute: pr,
            userAddress: sender,
            slippagePct,
        });

        const tx = await wallet.sendTransaction({
            to: built.to,
            data: built.data,
            value: built.value ? BigInt(built.value) : 0n,
        });
        log(`→ ParaSwap sent: ${tx.hash}`);
        const rc = await tx.wait();
        log(`✔ ParaSwap confirmed: ${rc?.hash}`);

    } else if (winner.dex === "kyberswap") {
        const summary = winner.raw;
        if (!summary) throw new Error("Kyber: missing routeSummary from quote");

        const built = await buildKyberTx(chain.kyberPath, {
            routeSummary: summary,
            sender,
            recipient,
            slippageBps,
        });

        const spender = built.routerAddress || winner.spender;
        if (!spender) throw new Error("Kyber: missing routerAddress/spender");

        await ensureAllowance(srcToken, sender, spender, BigInt(srcAmountRaw), wallet, log);

        const tx = await wallet.sendTransaction({
            to: built.to,
            data: built.data,
            value: built.value ? BigInt(built.value) : 0n,
        });
        log(`→ Kyber sent: ${tx.hash}`);
        const rc = await tx.wait();
        log(`✔ Kyber confirmed: ${rc?.hash}`);

    } else {
        throw new Error(`Unknown dex: ${(winner as any).dex}`);
    }

    // Optional: return recipient balance of out token
    const out = new ethers.Contract(dstToken, erc20Abi, provider);
    const bal = await out.balanceOf(recipient);
    return {
        network,
        recipient,
        outToken: dstToken,
        outBalance: ethers.formatUnits(bal, dstDecimals),
    };
}

async function main() {
    await swap("usdc", "usdt", "0.1", {
        network: "arbitrum",
        slippage: 5,                 // optional (0.30%)
        useProviderGasPrice: true,
    });
}
main();

// // ===================== Convenience CLI / example =====================
// // npx ts-node aggregatedSwap.ts usdc usdt 0.1 arbitrum
// if (require.main === module) {
//     (async () => {
//         const [, , tIn, tOut, amt, net] = process.argv;
//         if (!tIn || !tOut || !amt) {
//             console.error("Usage: ts-node aggregatedSwap.ts <tokenIn> <tokenOut> <amountHuman> [arbitrum|base]");
//             process.exit(1);
//         }
//         const res = await swap(tIn, tOut, amt, { network: (net as Network) ?? "arbitrum" });
//         console.log("Result:", res);
//     })().catch(e => {
//         console.error("Fatal:", e?.message ?? e);
//         process.exit(1);
//     });
// }