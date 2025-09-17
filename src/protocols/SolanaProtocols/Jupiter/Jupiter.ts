import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, TransactionInstruction, SYSVAR_INSTRUCTIONS_PUBKEY, SYSVAR_RENT_PUBKEY, TransactionMessage, VersionedTransaction, Transaction } from "@solana/web3.js";
import { BN, Program, AnchorProvider } from "@coral-xyz/anchor";
import { Lending } from "./target/types/jupiter-lend";
import { U64_MAX } from "@kamino-finance/klend-sdk";
import { log } from "@uniswap/smart-order-router";

function parseTokenAccountBase64(base64Data: string) {
    const buf = Buffer.from(base64Data, "base64");
    const amount = new BN(buf.slice(64, 72), "le"); 
    return amount.toNumber()
}

export class Jupiter {
    provider: AnchorProvider;
    jupiterLending : PublicKey;
    jupiterLendingProgram : Program<Lending>;
    mint : PublicKey = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    lendingAdmin : PublicKey = new PublicKey("5nmGjA4s7ATzpBQXC5RNceRpaJ7pYw2wKsNBWyuSAZV6");
    lending : PublicKey = new PublicKey("2vVYHYM8VYnvZqQWpTJSj8o8DBf1wM8pVs3bsTgYZiqJ");
    fTokenMint : PublicKey = new PublicKey("9BEcn9aPEmhSPbPQeFGjidRiEKki46fVQDyPpSQXPA2D");
    supplyTokenReservesLiquidity : PublicKey = new PublicKey("94vK29npVbyRHXH63rRcTiSr26SFhrQTzbpNJuhQEDu");
    lendingSupplyPositionOnLiquidity : PublicKey = new PublicKey("Hf9gtkM4dpVBahVSzEXSVCAPpKzBsBcns3s8As3z77oF");
    rateModel : PublicKey = new PublicKey("5pjzT5dFTsXcwixoab1QDLvZQvpYJxJeBphkyfHGn688");
    vault : PublicKey = new PublicKey("BmkUoKMFYBxNSzWXyUjyMJjMAaVz4d8ZnxwwmhDCUXFB");
    claimAccount : PublicKey = new PublicKey("HN1r4VfkDn53xQQfeGDYrNuDKFdemAhZsHYRwBrFhsW");
    liquidity : PublicKey = new PublicKey("7s1da8DduuBFqGra5bJBjpnvL5E9mGzCuMk1Qkh4or2Z");
    liquidityProgram : PublicKey = new PublicKey("jupeiUmn818Jg1ekPURTpr4mFo29p46vygyykFJ3wZC");
    rewardsRateModel : PublicKey = new PublicKey("5xSPBiD3TibamAnwHDhZABdB4z4F9dcj5PnbteroBTTd");
    constructor(
        jupiterLendingProgram : Program<Lending>,
        provider: AnchorProvider
    ) {
        this.jupiterLendingProgram = jupiterLendingProgram;
        this.provider = provider;
    }

    async deposit (amount: BN) : Promise<TransactionInstruction[]> {
        let instructions: TransactionInstruction[] = [];

        instructions.push(
            await this.jupiterLendingProgram.methods.deposit(new BN(amount)).accounts({
                signer : this.provider.publicKey,
                lendingAdmin: this.lendingAdmin,
                lending: this.lending,
                supplyTokenReservesLiquidity: this.supplyTokenReservesLiquidity,
                lendingSupplyPositionOnLiquidity: this.lendingSupplyPositionOnLiquidity,
                rateModel: this.rateModel,
                vault: this.vault,
                liquidity: this.liquidity,
                rewardsRateModel: this.rewardsRateModel,
                tokenProgram: TOKEN_PROGRAM_ID,
            }).instruction()
        )
        return instructions;
    }

    async withdraw (amount: BN) : Promise<TransactionInstruction[]> {
        let instructions: TransactionInstruction[] = [];

        instructions.push(
            await this.jupiterLendingProgram.methods.withdraw(new BN(amount)).accounts({
                signer : this.provider.publicKey,
                lendingAdmin: this.lendingAdmin,
                lending: this.lending,
                supplyTokenReservesLiquidity: this.supplyTokenReservesLiquidity,
                lendingSupplyPositionOnLiquidity: this.lendingSupplyPositionOnLiquidity,
                rateModel: this.rateModel,
                vault: this.vault,
                claimAccount : this.claimAccount,
                liquidity: this.liquidity,
                rewardsRateModel: this.rewardsRateModel,
                tokenProgram: TOKEN_PROGRAM_ID,
            }).instruction()
        )
        return instructions;
    }

    async getPosition (depositedAmount : Number) {
        const balance_beforce = await this.provider.connection.getTokenAccountBalance(this.userTokenAta());
        const ix = await this.withdraw(new BN(U64_MAX))
        // console.log(ix);
        
        const latestBlockhash = await this.provider.connection.getLatestBlockhash();
        const message = new TransactionMessage({
            payerKey: this.provider.publicKey,
            recentBlockhash: latestBlockhash.blockhash,
            instructions: ix,
        }).compileToV0Message();
        const tx = new VersionedTransaction(message);
        tx.sign([this.provider.wallet.payer]);
        const simResult = await this.provider.connection.simulateTransaction(
            tx, {
            replaceRecentBlockhash: false,
            sigVerify: true, 
            accounts: {
                encoding: "base64",
                addresses: [
                    this.userTokenAta().toString(),
                ],
            },
        });
        return parseTokenAccountBase64(simResult.value.accounts[0].data[0]) - Number(balance_beforce.value.amount) - Number(depositedAmount);
    }

    userTokenAta () {
        return getAssociatedTokenAddressSync(
            this.mint,
            this.provider.publicKey,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
    }
    userFTokenAta () {
        return getAssociatedTokenAddressSync(
            this.fTokenMint,
            this.provider.publicKey,
            false,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
    }
}