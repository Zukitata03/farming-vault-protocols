import { BN, Program, Wallet } from '@coral-xyz/anchor';
import { AnchorProvider } from "@project-serum/anchor";
import { Connection, Keypair, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import * as fs from 'fs';
import { Wasabi } from './Wasabi';
import WasabiSolanaIdl from '../target/idl/wasabi_solana.json';
import { WasabiSolana } from '../target/type/wasabi_solana';
import path from 'path';

class SolanaClient {
    constructor(
        private readonly connection: Connection,
        private readonly wallet: Keypair
    ) {}

    async sendTransaction(instructions: TransactionInstruction[]): Promise<string> {
        const transaction = new VersionedTransaction(
            new TransactionMessage({
                payerKey: this.wallet.publicKey,
                recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
                instructions: instructions,
            }).compileToV0Message()
        );
        transaction.sign([this.wallet]);
        return await this.connection.sendTransaction(transaction, {skipPreflight: true, preflightCommitment: 'confirmed'});
    }
}

(
    async () => {
        const connection = new Connection("https://api.mainnet-beta.solana.com");
        const keypairPath = path.resolve(__dirname, '../../../phantom-mainnet-keypair.json'); // Adjust the path to your keypair file
        const wallet = Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, 'utf8')))
        );
        const provider = new AnchorProvider(connection, new Wallet(wallet), { commitment: 'confirmed' });
        const wasabiProgram = new Program<WasabiSolana>(WasabiSolanaIdl as any);

        // Create SolanaClient Instance
        const solanaClient = new SolanaClient(connection, wallet);
        // Create Wasabi Instance
        const wasabi = new Wasabi(
            wasabiProgram,
            provider,
            'USDC'
        );
        
        // Example deposit transaction
        try {
            const instructions: TransactionInstruction[] = await wasabi.deposit(new BN(200000)); // Adjust the action and the amount as needed
            const signature = await solanaClient.sendTransaction(instructions);
            console.log("✅ Transaction sent with signature:", signature);
        } catch (error) {
            console.error("Error sending transaction:", error);
        }
    }
)();