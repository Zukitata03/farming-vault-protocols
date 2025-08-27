import { getUserVaultBalances } from 'wasabi-solana-ts';
import dotenv from 'dotenv';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Program, Wallet, AnchorProvider } from '@coral-xyz/anchor';
import { WasabiSolana } from 'wasabi-solana-ts';
import WasabiSolanaIdl from '../target/idl/wasabi_solana.json';
import fs from 'fs';

dotenv.config();

async function getUserLoans() {
    console.time("get user loans");
    const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com', 'confirmed');
    const wallet = Keypair.fromSecretKey(
      new Uint8Array(JSON.parse(fs.readFileSync('phantom-mainnet-keypair.json', 'utf8')))
    );
    const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: 'confirmed' });
    const wasabiProgram = new Program<WasabiSolana>(WasabiSolanaIdl as any, provider);
    const userPubkey = new PublicKey(process.env.USER_PUBLIC_KEY ? process.env.USER_PUBLIC_KEY : "8HNacqZWrKQqe9YTDsiwPyq2y2wqtqjdLXhUgiJDcufH");   
    if (!userPubkey) {
        throw new Error("USER_PUBLIC_KEY is not set in the environment variables.");
    }
    // Fetch loans for this user
    const userLoans = await getUserVaultBalances(wasabiProgram, userPubkey);

    console.log('User Loans:', userLoans);
    console.timeEnd("get user loans");
}

getUserLoans().catch(console.error);