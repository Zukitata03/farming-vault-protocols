import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, TransactionInstruction, SYSVAR_INSTRUCTIONS_PUBKEY, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { markets, mints, reserves, reserveFarmStates } from "./retrieve_rand_addr";
import { BN } from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@project-serum/anchor";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { KaminoLending } from "../target/types/kamino_lending";
import { KaminoFarming } from "../target/types/kamino_farming";

export class Kamino {
    kaminoLending: PublicKey;
    kaminoFarming: PublicKey;
    scopePrices: PublicKey = new PublicKey("3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C");
    globalConfig: PublicKey = new PublicKey("6UodrBjL2ZreDy7QdR4YV1oxqMBjVYSEyrFpctqqwGwL");
    lendingProgram: Program<KaminoLending>;
    farmingProgram: Program<KaminoFarming>;
    provider: AnchorProvider;
    market: PublicKey;
    mint: PublicKey;
    reserve: PublicKey; // per market, per mint
    reserveFarmState: PublicKey; // per reserve

    constructor(
        lendingProgram: Program<KaminoLending>, 
        farmingProgram: Program<KaminoFarming>, 
        provider: AnchorProvider, 
        market: string, 
        mint: string
    ) {
        this.lendingProgram = lendingProgram;
        this.farmingProgram = farmingProgram;
        this.kaminoLending = lendingProgram.programId;
        this.kaminoFarming = farmingProgram.programId;
        this.provider = provider;
        try {
            this.market = markets.get(market) ?? (() => { throw new Error(`Market not found: ${market}`); })();
            this.mint = mints.get(mint) ?? (() => { throw new Error(`Mint not found: ${mint}`); })();
            this.reserve = reserves.get(market)?.get(mint) ?? (() => { throw new Error(`Reserve not found for market: ${market}, mint: ${mint}`); })();
            this.reserveFarmState = reserveFarmStates.get(market)?.get(mint) ?? (() => { throw new Error(`Reserve farm state not found for market: ${market}, mint: ${mint}`); })();
        } catch (error) {
            throw error;
        }

        // console.log("Kamino initialized with:");
        // console.log("Market:", this.market.toString());
        // console.log("Mint:", this.mint.toString());
        // console.log("Reserve:", this.reserve.toString());
        // console.log("Reserve Farm State:", this.reserveFarmState.toString());
    }

    async deposit(amount: BN): Promise<TransactionInstruction[]> {
        let instructions: TransactionInstruction[] = [];

        // Refresh reserve
        console.log("Refreshing reserve...");
            instructions.push(
                await this.lendingProgram.methods.refreshReserve()
                    .accounts({
                        reserve: this.reserve,
                        lendingMarket: this.market,
                        pythOracle: this.kaminoLending,
                        switchboardPriceOracle: this.kaminoLending,
                        switchboardTwapOracle: this.kaminoLending,
                        scopePrices: this.scopePrices,
                    })
                    .instruction()
            );

        const obligation = this.obligation(); // per user, per market
        // console.log("Using obligation:", obligation.toString());
        const obligationInfo = await this.lendingProgram.account.Obligation.fetchNullable(obligation);

        const obligationFarm = this.obligationFarm(obligation, this.reserveFarmState);
        // console.log("Using obligation farm:", obligationFarm.toString());
        const obligationFarmInfo = await this.lendingProgram.provider.connection.getAccountInfo(obligationFarm);
        // console.log("Obligation farm info:", obligationFarmInfo);

        if (!obligationInfo) {
            console.log("User obligation is not initialized, initializing now");
            instructions.push(
                await this.lendingProgram.methods.initObligation({ tag: 0, id: 0 })
                    .accounts({
                        obligationOwner: this.provider.wallet.publicKey,
                        feePayer: this.provider.wallet.publicKey,
                        obligation: obligation,
                        lendingMarket: this.market,
                        seed1Account: SYSTEM_PROGRAM_ID,
                        seed2Account: SYSTEM_PROGRAM_ID,
                        ownerUserMetadata: this.userMetadata(),
                        rent: SYSVAR_RENT_PUBKEY,
                        systemProgram: SYSTEM_PROGRAM_ID,
                    }
                    ).instruction()
            );
        } else {
            console.log("User obligation is already initialized, refreshing now");
            const obligationData = await this.lendingProgram.account.Obligation.fetch(obligation) as any;

            let isVaultExhausted: boolean;
            if (obligationData.deposits[0].depositedAmount == 0) {
                isVaultExhausted = true;
            } else {
                isVaultExhausted = false;
            }

            instructions.push(
                await this.lendingProgram.methods.refreshObligation()
                    .accounts({
                        lendingMarket: this.market,
                        obligation: obligation,
                    })
                    .remainingAccounts(isVaultExhausted ? [] : [{ pubkey: this.reserve, isSigner: false, isWritable: true }])
                    .instruction()
            )
        }

        if (!obligationFarmInfo) {
            console.log("Obligation farm is not initialized, initializing now");
            instructions.push(
                await this.lendingProgram.methods.initObligationFarmsForReserve(0)
                    .accounts({
                        payer: this.provider.wallet.publicKey,
                        owner: this.provider.wallet.publicKey,
                        obligation: obligation,
                        lendingMarketAuthority: this.lendingMarketAuthority(),
                        reserve: this.reserve,
                        reserveFarmState: this.reserveFarmState,
                        obligationFarm: obligationFarm,
                        lendingMarket: this.market,
                        farmsProgram: this.kaminoFarming,
                        rent: SYSVAR_RENT_PUBKEY,
                        systemProgram: SYSTEM_PROGRAM_ID,
                    })
                    .instruction()
            );
        } else {
            console.log("Obligation farm is already initialized, refreshing now");
            instructions.push(
                await this.lendingProgram.methods.refreshObligationFarmsForReserve(0)
                    .accounts({
                        crank: this.provider.wallet.publicKey,
                        baseAccounts: {
                            obligation: obligation,
                            lendingMarketAuthority: this.lendingMarketAuthority(),
                            lendingMarket: this.market,
                            reserve: this.reserve,
                            reserveFarmState: this.reserveFarmState,
                            obligationFarmUserState: obligationFarm,
                        },
                        farmsProgram: this.kaminoFarming,
                        rent: SYSVAR_RENT_PUBKEY,
                        systemProgram: SYSTEM_PROGRAM_ID,
                    })
                    .instruction()
            )
        }

        // Deposit
        console.log("Depositing...");
        instructions.push(
            await this.lendingProgram.methods.depositReserveLiquidityAndObligationCollateralV2(amount)
                .accounts({
                    depositAccounts: {
                        owner: this.provider.wallet.publicKey,
                        obligation: this.obligation(),
                        lendingMarket: this.market,
                        lendingMarketAuthority: this.lendingMarketAuthority(),
                        reserve: this.reserve,
                        reserveLiquidityMint: this.mint,
                        reserveLiquiditySupply: this.liquiditySupplyVault(),
                        reserveCollateralMint: this.collateralCTokenMint(),
                        reserveDestinationDepositCollateral: this.collateralSupplyVault(),
                        userSourceLiquidity: getAssociatedTokenAddressSync(this.mint, this.provider.wallet.publicKey),
                        placeholderUserDestinationCollateral: this.kaminoLending,
                        collateralTokenProgram: TOKEN_PROGRAM_ID,
                        liquidityTokenProgram: TOKEN_PROGRAM_ID,
                        instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
                    },
                    farmsAccounts: {
                        obligationFarmUserState: obligationFarm,
                        reserveFarmState: this.reserveFarmState,
                    },
                    farmsProgram: this.kaminoFarming,
                }).instruction()
        );
        return instructions;
    }

    async withdraw(amount: BN): Promise<TransactionInstruction[]> {
        let instructions: TransactionInstruction[] = [];
        // Refresh reserve
        console.log("Refreshing reserve...");
        instructions.push(
            await this.lendingProgram.methods.refreshReserve()
                .accounts({
                    reserve: this.reserve,
                    lendingMarket: this.market,
                    pythOracle: this.kaminoLending,
                    switchboardPriceOracle: this.kaminoLending,
                    switchboardTwapOracle: this.kaminoLending,
                    scopePrices: this.scopePrices,
                })
                .instruction()
        )
        // Refresh obligation
        console.log("Refreshing obligation...");
        const obligation = this.obligation();
        const obligationData = await this.lendingProgram.account.Obligation.fetch(obligation) as any;
        let isVaultExhausted: boolean;
        if (obligationData.deposits[0].depositedAmount == 0) {
            isVaultExhausted = true;
        } else {
            isVaultExhausted = false;
        }
        instructions.push(
            await this.lendingProgram.methods.refreshObligation()
                .accounts({
                    lendingMarket: this.market,
                    obligation: obligation,
                })
                .remainingAccounts(isVaultExhausted ? [] : [{ pubkey: this.reserve, isSigner: false, isWritable: true }])
                .instruction()
        )
        // Refresh obligation farms
        console.log("Refreshing obligation farms...");
        const obligationFarm = this.obligationFarm(obligation, this.reserveFarmState);
        instructions.push(
            await this.lendingProgram.methods.refreshObligationFarmsForReserve(0)
                .accounts({
                    crank: this.provider.wallet.publicKey,
                    baseAccounts: {
                        obligation: obligation,
                        lendingMarketAuthority: this.lendingMarketAuthority(),
                        lendingMarket: this.market,
                        reserve: this.reserve,
                        reserveFarmState: this.reserveFarmState,
                        obligationFarmUserState: obligationFarm,
                    },
                    farmsProgram: this.kaminoFarming,
                    rent: SYSVAR_RENT_PUBKEY,
                    systemProgram: SYSTEM_PROGRAM_ID,
                })
                .instruction()
        )
        // Withdraw
        console.log("Withdrawing...");
        instructions.push(
            await this.lendingProgram.methods.withdrawObligationCollateralAndRedeemReserveCollateralV2(amount)
                .accounts({
                    withdrawAccounts: {
                        owner: this.provider.wallet.publicKey,
                        obligation: this.obligation(),
                        lendingMarket: this.market,
                        lendingMarketAuthority: this.lendingMarketAuthority(),
                        withdrawReserve: this.reserve,
                        reserveLiquidityMint: this.mint,
                        reserveSourceCollateral: this.collateralSupplyVault(),
                        reserveCollateralMint: this.collateralCTokenMint(),
                        reserveLiquiditySupply: this.liquiditySupplyVault(),
                        userDestinationLiquidity: getAssociatedTokenAddressSync(this.mint, this.provider.wallet.publicKey),
                        placeholderUserDestinationCollateral: this.kaminoLending,
                        collateralTokenProgram: TOKEN_PROGRAM_ID,
                        liquidityTokenProgram: TOKEN_PROGRAM_ID,
                        instructionSysvarAccount: SYSVAR_INSTRUCTIONS_PUBKEY,
                    },
                    farmsAccounts: {
                        obligationFarmUserState: this.obligationFarm(this.obligation(), this.reserveFarmState),
                        reserveFarmState: this.reserveFarmState,
                    },
                    farmsProgram: this.kaminoFarming,
                }).instruction()
        )
        return instructions;
    }

    async claim(): Promise<TransactionInstruction[]> {
        const farmStateData = await this.farmingProgram.account.farmState.fetch(this.reserveFarmState);
        const numRewardTokens = farmStateData.numRewardTokens;
        if (numRewardTokens.isZero()) {
            throw new Error("⚠️  No reward tokens available to claim");
        }
        const rewardMints = farmStateData.rewardInfos as { token: { mint: PublicKey } }[];
        let instructions: TransactionInstruction[] = [];

        for (let i = 0; i < numRewardTokens.toNumber(); i++) {
            const rewardMint = rewardMints[i].token.mint;
            const userRewardAta = this.userRewardAta(rewardMint);
            const userRewardAtaInfo = await this.provider.connection.getAccountInfo(userRewardAta);

            if (!userRewardAtaInfo) {
                console.log("User reward ATA not found, creating it now");
                instructions.push(
                    createAssociatedTokenAccountInstruction(
                        this.provider.wallet.publicKey,
                        userRewardAta,
                        this.provider.wallet.publicKey,
                        rewardMint,
                    ));
            } else {
                console.log("User reward ATA already exists, skipping creation");
            }

            instructions.push(
                await this.farmingProgram.methods.harvestReward(new BN(i))
                    .accounts({
                        owner: this.provider.wallet.publicKey,
                        userState: this.obligationFarm(this.obligation(), this.reserveFarmState),
                        farmState: this.reserveFarmState,
                        globalConfig: this.globalConfig,
                        rewardMint: rewardMint,
                        userRewardAta: this.userRewardAta(rewardMint),
                        rewardsVault: this.rewardsVault(rewardMint),
                        rewardsTreasuryVault: this.rewardsTreasuryVault(rewardMint),
                        farmVaultsAuthority: this.farmVaultsAuthority(),
                        scopePrices: this.scopePrices,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .instruction()
            )
        }
        return instructions;
    }

    userMetadata() {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from('user_meta'),
                this.provider.wallet.publicKey.toBuffer(),
            ],
            this.kaminoLending
        )[0];
    }

    obligation() {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from([0]),
                Buffer.from([0]),
                this.provider.wallet.publicKey.toBuffer(),
                this.market.toBuffer(),
                SYSTEM_PROGRAM_ID.toBuffer(),
                SYSTEM_PROGRAM_ID.toBuffer()
            ],
            this.kaminoLending
        )[0];
    }

    obligationFarm(obligation: PublicKey, reserveFarmState: PublicKey) {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from('user'),
                reserveFarmState.toBuffer(),
                obligation.toBuffer(),
            ],
            this.kaminoFarming
        )[0];
    }

    liquiditySupplyVault() {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("reserve_liq_supply"),
                this.market.toBuffer(),
                this.mint.toBuffer(),
            ],
            this.kaminoLending
        )[0];
    }

    collateralCTokenMint() {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("reserve_coll_mint"),
                this.market.toBuffer(),
                this.mint.toBuffer(),
            ],
            this.kaminoLending
        )[0];
    }

    collateralSupplyVault() {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("reserve_coll_supply"),
                this.market.toBuffer(),
                this.mint.toBuffer(),
            ],
            this.kaminoLending
        )[0];
    }

    lendingMarketAuthority() {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("lma"),
                this.market.toBuffer(),
            ],
            this.kaminoLending
        )[0];
    }

    rewardsVault(rewardMint: PublicKey) {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("rvault"),
                this.reserveFarmState.toBuffer(),
                rewardMint.toBuffer()
            ],
            this.kaminoFarming
        )[0];
    }

    rewardsTreasuryVault(rewardMint: PublicKey) {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("tvault"),
                this.globalConfig.toBuffer(),
                rewardMint.toBuffer(),
            ],
            this.kaminoFarming
        )[0];
    }

    farmVaultsAuthority() {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("authority"),
                this.reserveFarmState.toBuffer(),
            ],
            this.kaminoFarming
        )[0];
    }

    userRewardAta(rewardMint: PublicKey) {
        return getAssociatedTokenAddressSync(
            rewardMint,
            this.provider.wallet.publicKey,
            false,
            TOKEN_PROGRAM_ID
        );
    }
}