// For RATE LIMITS
import { Address, createPublicClient, fallback, http } from "viem";
import { base, arbitrum } from "viem/chains";

const httpOpts = {
    // bundle multiple read requests together (server counts 1 request)
    batch: { wait: 25, batchSize: 10 },
    // let viem itself retry before we escalate
    retryCount: 6,
    retryDelay: 250,
    timeout: 30_000,
} as const;

function makeFallback(urls: (string | undefined)[]) {
    const list = urls.filter(Boolean).map((u) => http(u!, httpOpts));
    // if only one url, viem handles fine
    return list.length > 1 ? fallback(list, { rank: false, retryCount: 0 }) : list[0]!;
}

const baseTransport = makeFallback([
    "https://base.llamarpc.com",
    "https://base.drpc.org",        // e.g. Infura/QuickNode
    "https://mainnet.base.org",    // public (rate limited)
]);

const arbTransport = makeFallback([
    process.env.ARB_RPC_1,         // e.g. Alchemy
    process.env.ARB_RPC_2,         // e.g. Ankr/Chainstack
    "https://arb1.arbitrum.io/rpc" // public
]);

export const clientByChain = {
    base: createPublicClient({ chain: base, transport: baseTransport }),
    arbitrum: createPublicClient({ chain: arbitrum, transport: arbTransport }),
} as const;