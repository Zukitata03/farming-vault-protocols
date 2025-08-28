import { PublicKey, TransactionInstruction, SYSVAR_RENT_PUBKEY, Keypair} from '@solana/web3.js';
import { BN} from "@coral-xyz/anchor";
import Decimal from "decimal.js";
import { AnchorProvider, Program } from "@project-serum/anchor";
import { TOKEN_PROGRAM_ID } from '@coral-xyz/anchor/dist/cjs/utils/token';
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { mints, markets } from './get_rand_address';
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
import { MEMO_PROGRAM_ID } from '@solana/spl-memo';
import { RaydiumClmm } from '../target/types/raydium_clmm';
import {SqrtPriceMath, Raydium, PoolUtils, LiquidityMath} from "@raydium-io/raydium-sdk-v2";

export class RaydiumCLMM {
    concentratedLiquidityProgram: Program<RaydiumClmm>;
    provider: AnchorProvider;
    mint_A: PublicKey;
    mint_B: PublicKey;
    pool_state: PublicKey;
    nft_key_pair?: Keypair;
    nft_mint: PublicKey;
    ray: PublicKey = mints.get("RAY") ?? (() => {throw new Error("RAY mint not found")})();

    constructor(
        concentratedLiquidityProgram: Program<RaydiumClmm>, 
        provider: AnchorProvider, 
        mint_A: string, 
        mint_B: string, 
        nftMint?: PublicKey,
    ) {
        this.concentratedLiquidityProgram = concentratedLiquidityProgram;
        this.provider = provider;
        this.mint_A = mints.get(mint_A)?? (() => {throw new Error(`Mint ${mint_A} not found`)})();
        this.mint_B = mints.get(mint_B)?? (() => {throw new Error(`Mint ${mint_B} not found`)})();
        this.pool_state = markets.get(mint_A)?.get(mint_B) ?? (() => {throw new Error(`Pool state for ${mint_A} and ${mint_B} not found`)})();
        if (!nftMint) {
            this.nft_key_pair = Keypair.generate();
            this.nft_mint = this.nft_key_pair.publicKey;
        } else {
            this.nft_key_pair = undefined;
            this.nft_mint = nftMint;
        }
    }

    async deposit(
        depositAmount0: Decimal,
        depositAmount1: Decimal
    ): Promise<TransactionInstruction[]> {
        let instructions: TransactionInstruction[] = [];
        
        // Luồng: sqrtPriceX64 => Price => Lower Price & Upper Price => Lower Tick & Upper Tick => sqrtPriceX64A & sqrtPriceX64B 
        // =====================================================================================================================
        // SqrtPriceMath.sqrtPriceX64ToPrice() => +/- 0.1% Price => SqrtPriceMath.getTickFromPrice() => SqrtPriceMath.getSqrtPriceX64FromTick()
        const currentSqrtPriceX64 = (await this.concentratedLiquidityProgram.account.poolState.fetch(this.pool_state)).sqrtPriceX64;
        const price = SqrtPriceMath.sqrtPriceX64ToPrice(currentSqrtPriceX64, 6, 6);
        const tickLower = SqrtPriceMath.getTickFromPrice(price.minus(price.times(0.001)), 6, 6);
        const tickUpper = SqrtPriceMath.getTickFromPrice(price.plus(price.times(0.001)), 6, 6);
        const sqrtPriceX64A = SqrtPriceMath.getSqrtPriceX64FromTick(tickLower);
        const sqrtPriceX64B = SqrtPriceMath.getSqrtPriceX64FromTick(tickUpper);

        const poolStateInfo = await this.concentratedLiquidityProgram.account.poolState.fetch(this.pool_state);
        const tradeFeeRate = (await this.concentratedLiquidityProgram.account.ammConfig.fetch(poolStateInfo.ammConfig)).tradeFeeRate;

        // Tính amountA, amountB từ zapin
        const amountToSwapInfo = this.calAmountToSwap(
          depositAmount0,
          depositAmount1,
          currentSqrtPriceX64,
          tickLower,
          tickUpper,
          tradeFeeRate,
        );
        
        if (!amountToSwapInfo.amountSwap.eq(new BN(0))) {
            const raydium = await Raydium.load({
                connection: this.provider.connection
            })
            const data = await raydium.clmm.getPoolInfoFromRpc(this.pool_state.toString())

            const poolInfo = data.poolInfo as any
            const clmmPoolInfo = data.computePoolInfo
            const tickCache = data.tickData

            const { minAmountOut, remainingAccounts } = PoolUtils.computeAmountOutFormat({
                poolInfo: clmmPoolInfo,
                tickArrayCache: tickCache[this.pool_state.toString()],
                amountIn: amountToSwapInfo.amountSwap,
                tokenOut: poolInfo[amountToSwapInfo.zeroForOne ? 'mintB' : 'mintA'],
                //slip = 0.05%
                slippage: 0.0005,
                epochInfo: await raydium.fetchEpochInfo(),
            })

            instructions.push(await this.concentratedLiquidityProgram.methods.swapV2(
                amountToSwapInfo.amountSwap,
                new BN(0),
                new BN(0),
                true
            ).accounts({
                payer: this.provider.publicKey,
                ammConfig: poolStateInfo.ammConfig,
                poolState: this.pool_state,
                inputTokenAccount: amountToSwapInfo.zeroForOne ? await this.getATA(this.mint_A) : await this.getATA(this.mint_B),
                outputTokenAccount: amountToSwapInfo.zeroForOne ? await this.getATA(this.mint_B) : await this.getATA(this.mint_A),
                inputVault: amountToSwapInfo.zeroForOne ? poolStateInfo.tokenVault0 : poolStateInfo.tokenVault1,
                outputVault: amountToSwapInfo.zeroForOne ? poolStateInfo.tokenVault1 : poolStateInfo.tokenVault0,
                observationState: poolStateInfo.observationKey,
                tokenProgram: TOKEN_PROGRAM_ID,
                tokenProgram2022: TOKEN_2022_PROGRAM_ID,
                memoProgram: MEMO_PROGRAM_ID,
                inputVaultMint: amountToSwapInfo.zeroForOne ? poolStateInfo.tokenMint0 : poolStateInfo.tokenMint1,
                outputVaultMint: amountToSwapInfo.zeroForOne ? poolStateInfo.tokenMint1 : poolStateInfo.tokenMint0
            }).remainingAccounts(remainingAccounts.map((pubkey) => (
                { pubkey, isSigner: false, isWritable: true }
            ))).instruction())

            if (amountToSwapInfo.zeroForOne) {
                depositAmount0 = depositAmount0.sub(new Decimal(amountToSwapInfo.amountSwap.toString()))
                depositAmount1 = new Decimal(minAmountOut.amount.raw.toString())
            } else {
                depositAmount1 = depositAmount1.sub(new Decimal(amountToSwapInfo.amountSwap.toString()))
                depositAmount0 = new Decimal(minAmountOut.amount.raw.toString())
            }
        }
        
        // Tính liquidity từ amounts
        const liquidity = LiquidityMath.getLiquidityFromTokenAmounts(
            currentSqrtPriceX64,
            sqrtPriceX64A,
            sqrtPriceX64B,
            new BN(depositAmount0.toString()),
            new BN(depositAmount1.toString())
        )

        let position_nft_account = await this.getPositionNftAccount();
        let token_account_0 = await this.getATA(this.mint_A);
        let token_account_1 = await this.getATA(this.mint_B);

        const poolState = await this.concentratedLiquidityProgram.account.poolState.fetch(this.pool_state);
        const tick_array_lower_start_index = this.getArrayStartIndex(tickLower, poolState.tickSpacing);
        const tick_array_upper_start_index = this.getArrayStartIndex(tickUpper, poolState.tickSpacing);

        // Open position with NFT
        instructions.push(
            await this.concentratedLiquidityProgram.methods.openPositionWithToken22Nft(
                tickLower,
                tickUpper,
                tick_array_lower_start_index,
                tick_array_upper_start_index,
                liquidity,
                new BN(depositAmount0.toString()),
                new BN(depositAmount1.toString()),
                true,
                false,
            )
            .accountsStrict({
                payer: this.provider.wallet.publicKey,
                positionNftOwner: this.provider.wallet.publicKey,
                positionNftMint: this.nft_mint,
                positionNftAccount: position_nft_account,
                poolState: this.pool_state,
                protocolPosition: this.getProtocolPosition(tickLower, tickUpper),
                tickArrayLower: this.getTickArray(tick_array_lower_start_index),
                tickArrayUpper: this.getTickArray(tick_array_upper_start_index),
                personalPosition: this.getPersonalPosition(this.nft_mint),
                tokenAccount0: token_account_0,
                tokenAccount1: token_account_1,
                tokenVault0: this.getTokenVault(this.mint_A),
                tokenVault1: this.getTokenVault(this.mint_B),
                rent: SYSVAR_RENT_PUBKEY,
                systemProgram: SYSTEM_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                tokenProgram2022: TOKEN_2022_PROGRAM_ID,
                vault0Mint: this.mint_A,
                vault1Mint: this.mint_B,
            })
            .instruction()
        )
        console.log("Open Position with NFT Instructions:", instructions);
        return instructions; // Return the array of instructions
    }

    async increaseLiquidityV2(
        liquidity: BN,
        amount0Max: BN,
        amount1Max: BN,
        baseFlag: boolean = true
    ) {
        let instructions: TransactionInstruction[] = [];
        const personalPosition = this.getPersonalPosition(this.nft_mint);
        const personalPositionState = await this.concentratedLiquidityProgram.account.personalPositionState.fetch(personalPosition);
        console.log("Personal Position State:", personalPositionState);
        const poolState = await this.concentratedLiquidityProgram.account.poolState.fetch(this.pool_state);
        console.log("Pool State:", poolState);
        const tick_lower_index = personalPositionState.tickLowerIndex;
        const tick_upper_index = personalPositionState.tickUpperIndex;
        console.log("Tick Lower Index:", tick_lower_index);
        console.log("Tick Upper Index:", tick_upper_index);

        const tick_array_lower_start_index = this.getArrayStartIndex(tick_lower_index, poolState.tickSpacing);
        const tick_array_upper_start_index = this.getArrayStartIndex(tick_upper_index, poolState.tickSpacing);
        instructions.push(
            await this.concentratedLiquidityProgram.methods.increaseLiquidityV2(
                liquidity,
                amount0Max,
                amount1Max,
                baseFlag
            )
            .accounts({
                nftOwner: this.provider.wallet.publicKey,
                nftAccount: await this.getPositionNftAccount(),
                poolState: this.pool_state,
                protocolPosition: this.getProtocolPosition(tick_lower_index, tick_upper_index),
                personalPosition,
                tickArrayLower: this.getTickArray(tick_array_lower_start_index),
                tickArrayUpper: this.getTickArray(tick_array_upper_start_index),
                tokenAccount0: await this.getATA(this.mint_A),
                tokenAccount1: await this.getATA(this.mint_B),
                tokenVault0: this.getTokenVault(this.mint_A),
                tokenVault1: this.getTokenVault(this.mint_B),
                tokenProgram: TOKEN_PROGRAM_ID,
                tokenProgram2022: TOKEN_2022_PROGRAM_ID,
                vault0Mint: this.mint_A,
                vault1Mint: this.mint_B,
            })
            .instruction()
        )
        console.log("Increase Liquidity V2 Instructions:", instructions);
        return instructions; // Return the array of instructions
    }

    async decreaseLiquidityV2(
        liquidity: BN,
        amount_0_min: BN,
        amount_1_min: BN
    ): Promise<TransactionInstruction[]> {
        let instructions: TransactionInstruction[] = [];
        const personalPosition = this.getPersonalPosition(this.nft_mint);
        const personalPositionState = await this.concentratedLiquidityProgram.account.personalPositionState.fetch(personalPosition);
        // console.log("Personal Position State:", personalPositionState);
        const poolStateInfo = await this.concentratedLiquidityProgram.account.poolState.fetch(this.pool_state);
        // console.log("Pool State:", poolStateInfo);
        const tick_lower_index = personalPositionState.tickLowerIndex;
        const tick_upper_index = personalPositionState.tickUpperIndex;
        console.log("Tick Lower Index:", tick_lower_index);
        console.log("Tick Upper Index:", tick_upper_index);
        
        const tick_array_lower_start_index = this.getArrayStartIndex(tick_lower_index, poolStateInfo.tickSpacing);
        const tick_array_upper_start_index = this.getArrayStartIndex(tick_upper_index, poolStateInfo.tickSpacing);
        console.log("Tick Array Lower Start Index:", tick_array_lower_start_index);
        console.log("Tick Array Upper Start Index:", tick_array_upper_start_index);

        let remainingAccounts = []

        for (let rewardInfo of poolStateInfo.rewardInfos as any) {
            if (rewardInfo.tokenMint.toString() != PublicKey.default.toString()) {
                remainingAccounts.push({ pubkey: rewardInfo.tokenVault, isSigner: false, isWritable: true })
                remainingAccounts.push({ pubkey: await getAssociatedTokenAddress(rewardInfo.tokenMint, this.provider.wallet.publicKey), isSigner: false, isWritable: true })
                remainingAccounts.push({ pubkey: rewardInfo.tokenMint, isSigner: false, isWritable: false })
            }
        }

        console.log("Remaining Accounts:", remainingAccounts);

        instructions.push(
            await this.concentratedLiquidityProgram.methods.decreaseLiquidityV2(
                liquidity,
                amount_0_min,
                amount_1_min
            )
            .accounts({
                nftOwner: this.provider.wallet.publicKey,
                nftAccount: await this.getPositionNftAccount(),
                personalPosition,
                poolState: this.pool_state,
                protocolPosition: this.getProtocolPosition(tick_lower_index, tick_upper_index),
                tokenVault0: this.getTokenVault(this.mint_A),
                tokenVault1: this.getTokenVault(this.mint_B),
                tickArrayLower: this.getTickArray(tick_array_lower_start_index),
                tickArrayUpper: this.getTickArray(tick_array_upper_start_index),
                recipientTokenAccount0: await this.getATA(this.mint_A),
                recipientTokenAccount1: await this.getATA(this.mint_B),
                tokenProgram: TOKEN_PROGRAM_ID,
                tokenProgram2022: TOKEN_2022_PROGRAM_ID,
                memoProgram: MEMO_PROGRAM_ID,
                vault0Mint: this.mint_A,
                vault1Mint: this.mint_B,
            })
            .remainingAccounts(remainingAccounts)
            .instruction()
        )
        console.log("Decrease Liquidity V2 Instructions:", instructions);
        return instructions; // Return the array of instructions
    }

    async closePosition(): Promise<TransactionInstruction[]> {
        let instructions: TransactionInstruction[] = [];
        const personalPosition = this.getPersonalPosition(this.nft_mint);
        const positionNftAccount = await this.getPositionNftAccount();
        instructions.push(
            await this.concentratedLiquidityProgram.methods.closePosition()
            .accounts({
                nftOwner: this.provider.wallet.publicKey,
                positionNftMint: this.nft_mint,
                personalPosition,
                positionNftAccount,
                systemProgram: SYSTEM_PROGRAM_ID,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .instruction()
        )
        console.log("Close Position Instructions:", instructions);
        return instructions; // Return the array of instructions
    }

    private i32ToBuffer(value: number): Buffer {
        const buffer = Buffer.alloc(4); // 4 bytes for i32
        buffer.writeInt32BE(value, 0);  // write signed int32 as big-endian
        return buffer;
    }

    private getProtocolPosition(
        tick_lower_index: number,
        tick_upper_index: number
    ): PublicKey {
        let protocol_position = findProgramAddressSync([Buffer.from("position"), this.pool_state.toBuffer(), this.i32ToBuffer(tick_lower_index), this.i32ToBuffer(tick_upper_index)], this.concentratedLiquidityProgram.programId)[0];
        // console.log("Protocol Position:", protocol_position.toBase58());
        return protocol_position;
    }

    private getTickArray(
        tick_array_start_index: number
    ): PublicKey {
        let tick_array = findProgramAddressSync([Buffer.from("tick_array"), this.pool_state.toBuffer(), this.i32ToBuffer(tick_array_start_index)], this.concentratedLiquidityProgram.programId)[0];
        // console.log("Tick Array:", tick_array.toBase58());
        return tick_array;
    }

    private getTokenVault(mint: PublicKey): PublicKey {
        const token_vault = findProgramAddressSync([Buffer.from("pool_vault"), this.pool_state.toBuffer(), mint.toBuffer()], this.concentratedLiquidityProgram.programId)[0];
        // console.log("Token Vault:", token_vault.toBase58());
        return token_vault;
    }

    private async getPositionNftAccount(): Promise<PublicKey> {
        let position_nft_account = await getAssociatedTokenAddress(
            this.nft_mint, 
            this.provider.wallet.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID            
        );
        // console.log("Position NFT Account:", position_nft_account.toBase58());

        return position_nft_account;
    }

    private async getATA(mint: PublicKey): Promise<PublicKey> {
        const ata = await getAssociatedTokenAddress(mint, this.provider.wallet.publicKey);
        // console.log("ATA:", ata.toBase58());
        return ata;
    }

    private getPersonalPosition(nftMint: PublicKey): PublicKey {
        const personal_position = findProgramAddressSync([Buffer.from("position"), nftMint.toBuffer()], this.concentratedLiquidityProgram.programId)[0];
        // console.log("Personal Position:", personal_position.toBase58());
        return personal_position;
    }

    private getArrayStartIndex(tickIndex: number, tickSpacing: number): number {
        const TICK_ARRAY_SIZE = 60;
        const ticksInArray = TICK_ARRAY_SIZE * tickSpacing;
        let start = Math.trunc(tickIndex / ticksInArray);
        if (tickIndex < 0 && tickIndex % ticksInArray !== 0) {
            start -= 1; // Adjust for negative tick index
        }
        return start * ticksInArray;
    }

    private calAmountToSwap(
        reserverAmount0: Decimal,
        reserverAmount1: Decimal,
        currentSqrtPriceX64: BN,
        tickLowerIndex: number,
        tickUpperIndex: number,
        tradeFeeRate: number,
        // decimalX: number,
        // decimalY: number
    ) {
        let currentPrice = SqrtPriceMath.sqrtPriceX64ToPrice(currentSqrtPriceX64, 0, 0) // Y over X
        let oneMinusSwapFee = new Decimal(1).minus(new Decimal(tradeFeeRate / 10 ** 6))
    
        // console.log(SqrtPriceMath.sqrtPriceX64ToPrice(SqrtPriceMath.getSqrtPriceX64FromTick(tickLowerIndex), decimalX, decimalY))
        // console.log(SqrtPriceMath.sqrtPriceX64ToPrice(SqrtPriceMath.getSqrtPriceX64FromTick(tickUpperIndex), decimalX, decimalY))
    
        let lowerSqrtPrice = SqrtPriceMath.sqrtPriceX64ToPrice(SqrtPriceMath.getSqrtPriceX64FromTick(tickLowerIndex), 0, 0).sqrt()
        let upperSqrtPrice = SqrtPriceMath.sqrtPriceX64ToPrice(SqrtPriceMath.getSqrtPriceX64FromTick(tickUpperIndex), 0, 0).sqrt()
        let currentSqrtPrice = SqrtPriceMath.sqrtPriceX64ToPrice(currentSqrtPriceX64, 0, 0).sqrt()
    
        let zeroForOne = true;
        let amountSwap = new BN(0);
    
        if (currentSqrtPrice.lessThan(lowerSqrtPrice)) {
            amountSwap = new BN(reserverAmount1.toString())
            zeroForOne = false
            return { amountSwap, zeroForOne }
        }
    
        if (currentSqrtPrice.greaterThanOrEqualTo(upperSqrtPrice)) {
            amountSwap = new BN(reserverAmount0.toString())
            return { amountSwap, zeroForOne }
        }
    
        //target ratio: the ratio of pooled tokenX and tokenY at current position
        let numeratorTargetRatio = new Decimal(1).div(currentSqrtPrice).minus(new Decimal(1).div(upperSqrtPrice));
        let denominatoTargetRatio = currentSqrtPrice.minus(lowerSqrtPrice)
        let targetRatio = numeratorTargetRatio.div(denominatoTargetRatio) // 1 Y = ratio X
    
        //current ratio: the ratio of tokenX and tokenY in this wallet 
        let currentRatio = reserverAmount0.div(reserverAmount1)
        if (currentRatio.lessThan(targetRatio)) {
            zeroForOne = false
        } else if (currentPrice.eq(targetRatio)) {
            return { amountSwap, zeroForOne }
        }
    
        //amountSwap = dX
        //(X - dX) / (Y + dY) = targetRatio
        //(X - dX) / (Y + dX * currentPrice * oneMinusSwapFee) = targetRatio
        //...
        if (zeroForOne) {
            let numeratorSwap = reserverAmount0.minus(targetRatio.mul(reserverAmount1))
            let denominatorSwap = new Decimal(1).add(currentPrice.mul(oneMinusSwapFee).mul(targetRatio))
            amountSwap = new BN(Decimal.floor(numeratorSwap.div(denominatorSwap)).toString())
    
        }
        //amountSwap = dY
        //(X + dX) / (Y - dY) = targetRatio
        //(X + dY / currentPrice * oneMinusSwapFee) / (Y - dY) = targetRatio  
        //...
        else {
            let numeratorSwap = currentPrice.mul(targetRatio.mul(reserverAmount1).minus(reserverAmount0))
            let denominatorSwap = oneMinusSwapFee.add(currentPrice.mul(targetRatio))
            amountSwap = new BN(Decimal.floor(numeratorSwap.div(denominatorSwap)).toString())
        }
    
        return { amountSwap, zeroForOne }
    }
}
