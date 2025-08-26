// import * as ethersV6 from "ethers-v6";
import { ethers } from "ethers";
import type { ContractCall, Protocol, Vault } from "../types/protocol";
// import { metaMorphoAbi } from "@morpho-org/blue-sdk-viem";
import { vaults } from "../registry/vault.base";
import { encodeFunctionData, maxUint256 } from "viem";
import { buildCall } from "../utils/callBuilder";
import { erc20Abi } from "viem";
import { getAllowance, getShareTokenBalance } from "../utils/walletHelper";
import { metaMorphoAbi } from "@morpho-org/blue-sdk-viem";
import { coerceDepositAmount, coerceShareAmount } from "../utils/amount";
const Morpho: Protocol = {
    key: "morpho",
    chain: "base",
    getVault(vaultId: string): Vault {
        const v = (vaults as any)[vaultId];
        if (!v) throw new Error(`Vault not found: ${vaultId}`);
        return {
            id: vaultId,
            name: v.name ?? vaultId,
            router: v.router,
            vault: v.vault ?? v.router,
            share: v.share,
            depositToken: v.depositToken,
            decimals: v.decimals,
        };
    },

    async deposit(vaultId: string, assets: bigint, wallet: `0x${string}`) {
        const v = this.getVault(vaultId);
        const calls: ContractCall[] = [];
        const amountIn = coerceDepositAmount(vaultId, assets);
        const allowance = await getAllowance(v.depositToken, v.vault, wallet, this.chain);
        if (amountIn > allowance) {
            calls.push(buildCall(v.depositToken, erc20Abi, "approve", [v.vault, maxUint256]));
        }

        calls.push(buildCall(v.vault, metaMorphoAbi, "deposit", [amountIn, wallet]));
        return calls;
    },

    // Withdraw by ASSETS (USDC). Internally the vault will burn shares.
    async withdraw(vaultId: string, assets: bigint, wallet: `0x${string}`) {
        const v = this.getVault(vaultId);
        // You can also call previewWithdrawAssets here and log it if you want.
        const amountIn = coerceShareAmount(vaultId, assets);
        return [buildCall(v.vault, metaMorphoAbi, "withdraw", [amountIn, wallet, wallet])];
    },
}
export default Morpho;