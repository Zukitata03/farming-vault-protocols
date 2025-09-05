// File: src/protocols/SolanaProtocols/Kamino/src/pnl.ts

import dotenv from 'dotenv';
import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { AnchorProvider, BN } from '@project-serum/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { KAMINO_LENDING_PROGRAM } from './client';
import { markets } from './retrieve_rand_addr';

dotenv.config();

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

class ReadonlyWallet {
    constructor(public publicKey: PublicKey) { }
    async signTransaction<T>(tx: T): Promise<T> { return tx; }
    async signAllTransactions<T>(txs: T[]): Promise<T[]> { return txs; }
}

async function computeDepositValue(
    provider: AnchorProvider,
    lendingMarket: PublicKey,
    owner: PublicKey,
    initialDepositUsd: number
) {
    const klend = KAMINO_LENDING_PROGRAM(provider, lendingMarket);
    const ob: any = await klend.obligationByPubkey(owner).catch(() => null);

    if (!ob) {
        return {
            currentDepositUsd: 0,
            pnlUsd: -initialDepositUsd,
            roi: initialDepositUsd > 0 ? -1 : 0,
        };
    }

    let currentDepositUsd = 0;
    for (const d of (ob.deposits ?? [])) {
        const usd = await klend.getUsdcByCollateral(new BN(d.depositedAmount));
        currentDepositUsd += Number(usd) || 0;
    }

    const pnlUsd = currentDepositUsd - initialDepositUsd;
    const roi = initialDepositUsd > 0 ? pnlUsd / initialDepositUsd : 0;

    return { currentDepositUsd, pnlUsd, roi };
}

function f(n: number, d = 6) {
    return (Number.isFinite(n) ? n : 0).toFixed(d);
}

async function main() {
    const rl = readline.createInterface({ input, output });

    const marketName = await rl.question('Enter Market Name: ');
    const walletStr = await rl.question('Enter Wallet Public Key: ');
    const initialDepositStr = await rl.question('Enter Initial Deposit (USD): ');
    rl.close();

    const marketAddrStr = markets.get(marketName);
    if (!marketAddrStr) {
        const available = [...markets.keys()].join(', ');
        throw new Error(`Unknown market: "${marketName}". Available: ${available}`);
    }

    const initialDepositUsd = Number(initialDepositStr);
    if (!Number.isFinite(initialDepositUsd) || initialDepositUsd < 0) {
        throw new Error('Initial deposit must be a non-negative number (USD)');
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    const owner = new PublicKey(walletStr);
    const wallet = new ReadonlyWallet(owner);
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
    const lendingMarket = new PublicKey(marketAddrStr.toString());

    const { currentDepositUsd, pnlUsd, roi } =
        await computeDepositValue(provider, lendingMarket, owner, initialDepositUsd);

    console.log('\n--- Kamino Lend PnL (Lending Only) ---');
    console.log(`Wallet:               ${owner.toBase58()}`);
    console.log(`Market:               ${marketName}`);
    console.log(`Initial Deposit (USD):${f(initialDepositUsd)}`);
    console.log(`Current Value  (USD): ${f(currentDepositUsd)}`);
    console.log(`PnL           (USD):  ${f(pnlUsd)}`);
    console.log(`ROI:                  ${(roi * 100).toFixed(2)}%`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
