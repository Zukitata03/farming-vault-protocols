import { WasabiSolana } from '../target/type/wasabi_solana';
import { PublicKey, TransactionInstruction} from '@solana/web3.js';
import { BN } from "@coral-xyz/anchor";
import { AnchorProvider } from "@project-serum/anchor";
import { Program } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
import { mints } from './get_rand_addr';
export class Wasabi {
    private wasabiProgram: Program<WasabiSolana>;
    private provider: AnchorProvider;
    private assetMint: PublicKey;
    private shareMint: PublicKey;

    constructor(
        wasabiProgram: Program<WasabiSolana>,
        provider: AnchorProvider,
        mint: string,
    ){
        this.wasabiProgram = wasabiProgram;
        this.provider = provider;
        this.assetMint = mints.get(mint)?.[0] ?? (() => {throw new Error(`Mint ${mint} not found in mints map.`);})();
        this.shareMint = mints.get(mint)?.[1] ?? (() => {throw new Error(`Mint ${mint} not found in mints map.`);})();
    }

    async deposit(
        amount: BN,
    ): Promise<TransactionInstruction[]> {
        const instructions: TransactionInstruction[] = [];
        const ownerSharesAccount = await this.getOwnerSharesAccount();
        if (await this.provider.connection.getAccountInfo(ownerSharesAccount) === null) {
            instructions.push(
                createAssociatedTokenAccountInstruction(
                    this.provider.wallet.publicKey,
                    ownerSharesAccount,
                    this.provider.wallet.publicKey,
                    this.shareMint,
                    TOKEN_2022_PROGRAM_ID
                )
            );
        }

        instructions.push (
            await this.wasabiProgram.methods.deposit(amount)
            .accounts(await this.getAccounts())
            .instruction()
        );

        return instructions;
    }

    async redeem(
        sharesAmount: BN,
    ): Promise<TransactionInstruction[]> {
        const instructions: TransactionInstruction[] = [];
        instructions.push(
            await this.wasabiProgram.methods.redeem(sharesAmount)
            .accounts(await this.getAccounts())
            .instruction()
        );
        return instructions;
    }

    async withdraw(
        amount: BN,
    ): Promise<TransactionInstruction[]> {
        const instructions: TransactionInstruction[] = [];
        instructions.push(
            await this.wasabiProgram.methods.withdraw(amount)
            .accounts(await this.getAccounts())
            .instruction()
        );
        return instructions;
    }

    async getAccounts(): Promise<{
        owner: PublicKey,
        ownerAssetAccount: PublicKey,
        ownerSharesAccount: PublicKey,
        lpVault: PublicKey,
        vault: PublicKey,
        assetMint: PublicKey,
        sharesMint: PublicKey,
        globalSettings: PublicKey,
        assetTokenProgram: PublicKey,
        sharesTokenProgram: PublicKey,
        eventAuthority: PublicKey,
        program: PublicKey,
    }> {
        return {
            owner: this.provider.wallet.publicKey,
            ownerAssetAccount: await this.getOwnerAssetAccount(),
            ownerSharesAccount: await this.getOwnerSharesAccount(),
            lpVault: this.getLpVault(this.assetMint),
            vault: this.getVault(),
            assetMint: this.assetMint,
            sharesMint: this.shareMint,
            globalSettings: await this.getGlobalSettings(),
            assetTokenProgram: TOKEN_PROGRAM_ID,
            sharesTokenProgram: TOKEN_2022_PROGRAM_ID,
            eventAuthority: await this.getEventAuthority(),
            program: this.wasabiProgram.programId,
        };
    }

    private getLpVault(mint: PublicKey): PublicKey {
        const lpVault = findProgramAddressSync(
            [
                Buffer.from("lp_vault"),
                mint.toBuffer(),
            ],
            this.wasabiProgram.programId
        )[0];
        // console.log(`LP Vault Address for ${mint.toBase58()}: ${lpVault.toBase58()}`);
        return lpVault;
    }

    private async getEventAuthority(): Promise<PublicKey> {
        const [eventAuthority] = findProgramAddressSync(
            [Buffer.from("__event_authority")],
            this.wasabiProgram.programId
        );
        // console.log(`Event Authority Address: ${eventAuthority.toBase58()}`);
        return eventAuthority;
    }

    private async getOwnerAssetAccount(): Promise<PublicKey> {
        const ownerAssetAccount = await getAssociatedTokenAddress(
            this.assetMint,
            this.provider.wallet.publicKey,
            false,
            TOKEN_PROGRAM_ID,
        );
        // console.log(`Owner Asset Account Address: ${ownerAssetAccount.toBase58()}`);
        return ownerAssetAccount;
    }

    private async getOwnerSharesAccount(): Promise<PublicKey> {
        const ownerSharesAccount = await getAssociatedTokenAddress(
            this.shareMint,
            this.provider.wallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID,
        );
        // console.log(`Owner Shares Account Address: ${ownerSharesAccount.toBase58()}`);
        return ownerSharesAccount;
    }

    private async getGlobalSettings(): Promise<PublicKey> {
        const [globalSettings] = findProgramAddressSync(
            [Buffer.from("global_settings")],
            this.wasabiProgram.programId
        );
        // console.log(`Global Settings Address: ${globalSettings.toBase58()}`);
        return globalSettings;
    }

    private getVault(): PublicKey {
        const vault = getAssociatedTokenAddressSync(
            this.assetMint,
            this.getLpVault(this.assetMint),
            true,
            TOKEN_PROGRAM_ID,
        );
        // console.log(`Vault Address: ${vault.toBase58()}`);
        return vault;
    }
}
