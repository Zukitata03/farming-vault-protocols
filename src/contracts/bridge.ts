import dotenv from "dotenv";
dotenv.config();

import { parseUnits, formatUnits } from "ethers";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, arbitrum } from "viem/chains";

import { setClientOptions, route, executeRoute } from "@skip-go/client/cjs";

import { getProvider, getWallet } from "../utils/walletHelper"; // keep your helpers
import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    VersionedTransaction,
    TransactionSignature,
} from "@solana/web3.js";

import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";

import {
    BaseSignerWalletAdapter,
    WalletReadyState,
    type WalletName,
    type SupportedTransactionVersions,
    type TransactionOrVersionedTransaction,
} from "@solana/wallet-adapter-base";

import nacl from "tweetnacl";



// ===== Env =====
const API_KEY = process.env.SKIP_API_KEY || ""; // optional; only needed if your Skip instance requires it
// if (API_KEY) setApiOptions({ apiKey: API_KEY });

const MNEMONIC = process.env.MNEMONIC_BASE || process.env.MNEMONIC_ARBITRUM || process.env.MNEMONIC_SOLANA || process.env.MNEMONIC || "";
if (!MNEMONIC && typeof window === "undefined") {
    throw new Error("Set MNEMONIC_BASE in env when running in Node");
}
const SOL_ACCT = Number(process.env.SOLANA_ACCOUNT_INDEX ?? 0);

// ===== RPC / Chains / USDC =====
const RPC: Record<string, string> = {
    "8453": "https://mainnet.base.org",
    "42161": "https://arb1.arbitrum.io/rpc",
};
const SOL_RPC = process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
setClientOptions({
    apiKey: API_KEY || undefined,
    endpointOptions: {
        getRpcEndpointForChain: async (chainId: string) => {
            if (chainId === "solana") return SOL_RPC;
            if (chainId in RPC) return RPC[chainId];
            throw new Error(`No RPC configured for chainId ${chainId}`);
        },
        getRestEndpointForChain: (_chainId: string) => undefined,
    },
});

const CHAIN = { SOL: "solana", BASE: "8453", ARB: "42161" } as const;
const USDC = {
    SOL: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    BASE: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    ARB: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
};

// === helpers ===
function summarize(ops: any[]) {
    return (ops || [])
        .map((op: any) => {
            if (op?.cctp_transfer) return "bridge:CCTP";
            if (op?.axelar_transfer) return `bridge:${op.axelar_transfer.bridge_id || "AXELAR"}`;
            if (op?.swap) return `swap:${op.swap?.swap_in?.swap_venue?.name || "swap"}`;
            return Object.keys(op)[0] || "step";
        })
        .join(" → ");
}

//EVM signer 
function evmAddressFromMnemonic(chainId: string): `0x${string}` {
    const provider = getProvider(RPC[chainId]);
    const wallet = getWallet(MNEMONIC, provider);
    return wallet.address as `0x${string}`;
}

function makeViem(chainId: string) {
    const rpc = RPC[chainId];
    const pk = getWallet(MNEMONIC, getProvider(rpc)).privateKey as `0x${string}`;
    const account = privateKeyToAccount(pk);
    const chain = chainId === CHAIN.BASE ? base : arbitrum;
    return createWalletClient({ account, chain, transport: http(rpc) });
}

async function solKeypairFromMnemonic(mnemonic: string, account = 0) {
    // Phantom-compatible path: m/44'/501'/{account}'/0'
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const path = `m/44'/501'/${account}'/0'`;
    const { key } = derivePath(path, seed.toString("hex"));
    return Keypair.fromSeed(key);
}

class IndexedMnemonicSolanaWalletAdapter extends BaseSignerWalletAdapter {
    name: WalletName<"IndexedMnemonicSolanaWallet"> =
        "IndexedMnemonicSolanaWallet" as WalletName<"IndexedMnemonicSolanaWallet">;
    url = "https://skip.build";
    icon = "";
    readonly readyState: WalletReadyState = WalletReadyState.Loadable;
    readonly supportedTransactionVersions: SupportedTransactionVersions = new Set(["legacy", 0] as const);

    private _publicKey: PublicKey | null = null;
    private _keypair: Keypair | null = null;
    private _connecting = false;
    private _connection: Connection;

    constructor(private _mnemonic: string, private _account = 0, rpc = "https://api.mainnet-beta.solana.com") {
        super();
        this._connection = new Connection(rpc, "confirmed");
    }

    get publicKey() { return this._publicKey; }
    get connecting() { return this._connecting; }

    async connect(): Promise<void> {
        this._connecting = true;
        try {
            if (!this._keypair) this._keypair = await solKeypairFromMnemonic(this._mnemonic, this._account);
            this._publicKey = this._keypair.publicKey;
            this.emit("connect", this._publicKey);
        } finally {
            this._connecting = false;
        }
    }

    async disconnect(): Promise<void> {
        this._publicKey = null;
        this._keypair = null;
        this.emit("disconnect");
    }

    async signTransaction<T extends TransactionOrVersionedTransaction<this['supportedTransactionVersions']>>(tx: T): Promise<T> {
        if (!this._keypair) throw new Error("Wallet not connected");

        const pubkey = this._keypair.publicKey;

        if (tx instanceof VersionedTransaction) {
            // v0: find our signer index in the static account keys
            const msg = tx.message;
            const acctKeys = msg.staticAccountKeys;
            const signerIndex = acctKeys.findIndex(k => k.equals(pubkey));
            if (signerIndex === -1) {
                return tx;
            }
            const messageBytes = msg.serialize(); // serialized MessageV0
            const sig = nacl.sign.detached(messageBytes, this._keypair.secretKey);
            if (!tx.signatures || tx.signatures.length < acctKeys.length) {
                const padded = new Array(acctKeys.length).fill(null).map(() => new Uint8Array(64));
                tx.signatures?.forEach((s, i) => { padded[i] = s as Uint8Array<ArrayBuffer>; });
                tx.signatures = padded;
            }
            tx.signatures[signerIndex] = sig;
            return tx as T;
        } else {
            // Legacy: partialSign appends our sig without mutating others
            (tx as Transaction).partialSign(this._keypair);
            return tx;
        }
    }

    async signAllTransactions<T extends TransactionOrVersionedTransaction<this['supportedTransactionVersions']>>(txs: T[]): Promise<T[]> {
        const out: T[] = [];
        for (const tx of txs) {
            out.push(await this.signTransaction(tx));
        }
        return out;
    }

    /** Do not submit from the adapter; Skip handles broadcast */
    async sendTransaction(): Promise<never> {
        throw new Error("sendTransaction should not be called; executeRoute() will broadcast after signing");
    }
}

function makeSvmSignerFromMnemonic(mnemonic: string, account = SOL_ACCT, rpc = "https://api.mainnet-beta.solana.com") {
    return new IndexedMnemonicSolanaWalletAdapter(mnemonic, account, rpc);
}

// ===== Core: bridge USDC (sol|base|arb) =====
export async function bridgeUSDC(
    source: "solana" | "base" | "arbitrum",
    dest: "solana" | "base" | "arbitrum",
    amountHuman: string,
    opts?: {
        getSvmSigner?: (chainId: string) => Promise<BaseSignerWalletAdapter | null | undefined>; // browser: pass Phantom adapter here
        rpcSolana?: string;
    }
) {
    const srcChain = source === "base" ? CHAIN.BASE : source === "arbitrum" ? CHAIN.ARB : CHAIN.SOL;
    const dstChain = dest === "base" ? CHAIN.BASE : dest === "arbitrum" ? CHAIN.ARB : CHAIN.SOL;
    const srcDenom = source === "base" ? USDC.BASE : source === "arbitrum" ? USDC.ARB : USDC.SOL;
    const dstDenom = dest === "base" ? USDC.BASE : dest === "arbitrum" ? USDC.ARB : USDC.SOL;

    const amountIn = parseUnits(amountHuman, 6).toString();
    const isSolanaInvolved = source === "solana" || dest === "solana";

    // 1) Quote
    const r = await route({
        sourceAssetDenom: srcDenom,
        sourceAssetChainId: srcChain,
        destAssetDenom: dstDenom,
        destAssetChainId: dstChain,
        amountIn,
        smartRelay: true,
        allowMultiTx: true,
        allowUnsafe: true,
    });

    console.log(`\n=== ${source} → ${dest} ===`);
    console.log("grossOut:", Number(formatUnits(r.amountOut, 6)).toFixed(6), "USDC");
    console.log("route:", summarize(r.operations));
    console.log("requiredChainAddresses:", r.requiredChainAddresses);

    // 2) Prepare Solana signer
    let svmAdapter: BaseSignerWalletAdapter | null = null;

    if (opts?.getSvmSigner) {
        // Browser path (e.g., Phantom adapter)
        svmAdapter = (await opts.getSvmSigner(CHAIN.SOL)) || null;
    } else if (typeof window === "undefined" && isSolanaInvolved) {
        // Node fallback (mnemonic + account index)
        svmAdapter = makeSvmSignerFromMnemonic(MNEMONIC, SOL_ACCT, opts?.rpcSolana ?? "https://api.mainnet-beta.solana.com");
    }

    if (svmAdapter && !svmAdapter.publicKey) {
        await svmAdapter.connect();
    }
    const solSigner = svmAdapter?.publicKey?.toBase58();
    console.log("solSigner:", solSigner);
    // 3) Build userAddresses from the adapter’s pubkey
    const userAddresses: Array<{ chainId: string; address: string }> = [];
    for (const cid of r.requiredChainAddresses) {
        if (cid === CHAIN.SOL) {
            if (!solSigner) throw new Error("Missing Solana signer (no adapter.publicKey)");
            userAddresses.push({ chainId: cid, address: solSigner });
        } else {
            userAddresses.push({ chainId: cid, address: evmAddressFromMnemonic(cid) });
        }
    }

    // 4) Execute (Skip will submit Solana after you sign)
    await executeRoute({
        route: r,
        userAddresses,
        getEvmSigner: async (cid) => makeViem(cid),
        getSvmSigner: r.requiredChainAddresses.includes(CHAIN.SOL)
            ? async () => svmAdapter!
            : undefined,
        simulate: true,
        batchSignTxs: true,
        slippageTolerancePercent: "0.5",
        onTransactionBroadcast: async ({ chainId, txHash }) => console.log("broadcast", chainId, txHash),
        onTransactionCompleted: async ({ chainId, txHash, status }) => console.log("completed", chainId, txHash, status?.state ?? status),
    });

    console.log("✅ done");
}

if (typeof window === "undefined" && require.main === module) {
    (async () => {
        const amount = process.argv[2] || "0.1";
        // Example: Solana → Base (USDC via CCTP)
        // await bridgeUSDC("solana", "base", amount);
        await bridgeUSDC("base", "arbitrum", amount);
    })().catch((e) => {
        console.error("Fatal:", e?.message || e);
        process.exit(1);
    });
}