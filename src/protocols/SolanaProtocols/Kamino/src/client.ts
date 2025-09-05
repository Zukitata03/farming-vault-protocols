import { Program, AnchorProvider, BN } from "@project-serum/anchor";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SYSTEM_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/native/system";
import Decimal from "decimal.js";

import { KaminoLending } from "../../IDL/kamino_lending";
import kaminoLendingIdl from "../../IDL/kamino_lending.json";

// ---- Program IDs (only what we need) ---------------------------------------
export const PROGRAM_IDS = {
    kaminoLending: new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"),
};

// ---- Hardcoded (USDC reserve & scope) – adjust if you need other reserves ---
const KAMINO_LENDING_ACCOUNTS = {
    scopePrices: new PublicKey("3NJYftD5sjVfxSnUdZ1wVML8f3aC6mp1CXCL6L7TnU8C"),
    usdcReserve: new PublicKey("Ga4rZytCpq1unD4DbEJ5bkHeUz9g3oh9AAFEi6vSauXp"),
    userMetadata: (authority: PublicKey) =>
        PublicKey.findProgramAddressSync(
            [Buffer.from("user_meta"), authority.toBuffer()],
            PROGRAM_IDS.kaminoLending
        )[0],
    obligation: (authority: PublicKey, lendingMarket: PublicKey) =>
        PublicKey.findProgramAddressSync(
            [
                Buffer.from([0]),
                Buffer.from([0]),
                authority.toBuffer(),
                lendingMarket.toBuffer(),
                SYSTEM_PROGRAM_ID.toBuffer(),
                SYSTEM_PROGRAM_ID.toBuffer(),
            ],
            PROGRAM_IDS.kaminoLending
        )[0],
};

export const KAMINO_LENDING_PROGRAM = (provider: AnchorProvider, lendingMarket: PublicKey) => {
    const kaminoLendingProgram: Program<KaminoLending> = new Program(
        kaminoLendingIdl as any,
        PROGRAM_IDS.kaminoLending,
        provider
    );

    return {
        /**
         * Read the user's Obligation (PDA derived off the given lendingMarket).
         */
        obligationByPubkey: (owner: PublicKey) =>
            kaminoLendingProgram.account.obligation.fetch(
                KAMINO_LENDING_ACCOUNTS.obligation(owner, lendingMarket)
            ),

        /**
         * Convert a collateral amount (cTokens) to USDC using the reserve’s exchange rate.
         * NOTE: This uses the **USDC reserve**. If you need multi-asset, add more reserves.
         */
        getUsdcByCollateral: async (collateralAmount: BN | number | string): Promise<number> => {
            const reserve: any = await kaminoLendingProgram.account.reserve.fetch(
                KAMINO_LENDING_ACCOUNTS.usdcReserve
            );
            const liquidity = reserve.liquidity;

            const fractional = new Decimal(2).pow(60); // fixed-point scale used in reserve
            const totalSupply = Decimal(liquidity.availableAmount.toString())
                .add(Decimal(liquidity.borrowedAmountSf.toString()).div(fractional))
                .sub(Decimal(liquidity.accumulatedProtocolFeesSf.toString()).div(fractional))
                .sub(Decimal(liquidity.accumulatedReferrerFeesSf.toString()).div(fractional))
                .sub(Decimal(liquidity.pendingReferrerFeesSf.toString()).div(fractional));

            const exchangeRate = Decimal(reserve.collateral.mintTotalSupply.toString()).div(totalSupply);
            const usdcAmount = Decimal(collateralAmount.toString()).div(exchangeRate).floor();
            return usdcAmount.toNumber();
        },
    };
};
