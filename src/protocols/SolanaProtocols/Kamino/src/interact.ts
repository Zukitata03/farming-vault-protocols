import {Kamino} from './Kamino';
import kaminoLendingIdl from '../target/idl/kamino_lending.json'
import kaminoFarmingIdl from '../target/idl/kamino_farming.json';
import {Program, AnchorProvider} from "@project-serum/anchor";
import {Connection} from "@solana/web3.js";
import * as anchor from '@coral-xyz/anchor';
import * as fs from 'fs';

const wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync('phantom-mainnet-keypair.json', 'utf8')))
);
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const provider = new AnchorProvider(connection, new anchor.Wallet(wallet), {
  commitment: 'confirmed',
});
const lendingProgram = new Program(kaminoLendingIdl as any, kaminoLendingIdl.address, provider);
const farmingProgram = new Program(kaminoFarmingIdl as any, kaminoFarmingIdl.address, provider);
const kamino = new Kamino(
    lendingProgram,
    farmingProgram,
    provider,
    "JPL Market",
    "USDC",
);

async function deposit() {
    try {
        console.log("Starting deposit interaction...");
        console.log("Wallet public key:", wallet.publicKey.toString());
        
        // Check wallet balance first
        const balance = await connection.getBalance(wallet.publicKey);
        console.log("Wallet SOL balance:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
        
        if (balance === 0) {
            console.warn("⚠️  Wallet has no SOL balance. You need SOL for transaction fees!");
            console.log("Please fund your wallet:", wallet.publicKey.toString());
            return;
        }

        // Example usage - depositing 5 USDS
        const amount = new anchor.BN(5000000); // 5 USDS in micro units
        console.log("Depositing amount:", amount.toString(), "micro-USDS");

        const instructions = await kamino.deposit(amount);
        console.log("Deposit instructions created:", instructions.length, "instructions");
        
        // Create and send transaction
        const transaction = new anchor.web3.Transaction().add(...instructions);
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        const signature = await provider.sendAndConfirm(transaction, [wallet]);
        console.log("✅ Transaction successful! Signature:", signature);
        
    } catch (error) {
        console.error("❌ Error during deposit:", error);
        
        // Provide helpful error messages
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('insufficient funds')) {
            console.log("💡 Make sure your wallet has enough USDC and SOL for fees");
        } else if (errorMessage.includes('AccountNotFound')) {
            console.log("💡 Make sure the reserve accounts are properly initialized");
        }
        
        throw error;
    }
}

async function withdraw() {
    try {
        console.log("Starting withdraw interaction...");
        console.log("Wallet public key:", wallet.publicKey.toString());
        
        // Check wallet balance first
        const balance = await connection.getBalance(wallet.publicKey);
        console.log("Wallet SOL balance:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
        
        if (balance === 0) {
            console.warn("⚠️  Wallet has no SOL balance. You need SOL for transaction fees!");
            console.log("Please fund your wallet:", wallet.publicKey.toString());
            return;
        }
        // Example usage - withdrawing 0.2 USDC (200000 micro-USDC)
        const amount = new anchor.BN(200000); // 0.2 USDC in micro units
        console.log("Withdrawing amount:", amount.toString(), "micro-USDC");
        
        const instructions = await kamino.withdraw(amount);
        console.log("Withdraw instructions created:", instructions.length, "instructions");
        
        // Create and send transaction
        const transaction = new anchor.web3.Transaction().add(...instructions);
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        const signature = await provider.sendAndConfirm(transaction, [wallet]);
        console.log("✅ Transaction successful! Signature:", signature);
    } catch (error) {
        console.error("❌ Error during withdraw:", error);
    }
}

async function claim() {
    try {
        console.log("Starting claim interaction...");
        console.log("Wallet public key:", wallet.publicKey.toString());
        
        // Check wallet balance first
        const balance = await connection.getBalance(wallet.publicKey);
        console.log("Wallet SOL balance:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
        
        if (balance === 0) {
            console.warn("⚠️  Wallet has no SOL balance. You need SOL for transaction fees!");
            console.log("Please fund your wallet:", wallet.publicKey.toString());
            return;
        }
        
        const instructions = await kamino.claim();
        console.log("Claim instructions created:", instructions.length, "instructions");
        
        // Create and send transaction
        const transaction = new anchor.web3.Transaction().add(...instructions);
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;
        
        const signature = await provider.sendAndConfirm(transaction, [wallet]);
        console.log("✅ Transaction successful! Signature:", signature);
    } catch (error) {
        console.error("❌ Error during claim:", error);
    }
}

// Execute the main function
// deposit().catch(console.error);
// withdraw().catch(console.error);
claim().catch(console.error);

