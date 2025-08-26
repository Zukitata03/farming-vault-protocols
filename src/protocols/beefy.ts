import { ethers } from "ethers";
import type { ContractCall, Protocol, Vault } from "../types/protocol";
import { vaults } from "../registry/vault.base";
import { maxUint256, erc20Abi } from "viem";
import { buildCall } from "../utils/callBuilder";
import { getAllowance } from "../utils/walletHelper";
import { BEEFY_ABI } from "../utils/abis";
import { coerceDepositAmount, coerceShareAmount } from "../utils/amount";
const Beefy: Protocol = {
    key: "beefy",
    chain: "base",
    getVault(vaultId: string): Vault {
        const v = (vaults as any)[vaultId];
        if (!v) throw new Error(`Vault not found: ${vaultId}`);
        return {
            id: vaultId,
            name: v.name ?? vaultId,
            router: v.router,
            vault: v.vault,
            share: v.share,
            depositToken: v.depositToken,
            decimals: v.decimals,
        };
    },

    async deposit(vaultId: string, assets: bigint, wallet: `0x${string}`) {
        const v = this.getVault(vaultId);
        const vaultConfig = (vaults as any)[vaultId];
        const chain = vaultConfig.chain;
        const calls: ContractCall[] = []
        const amountIn = coerceDepositAmount(vaultId, assets);
        const allowance = await getAllowance(v.depositToken, v.vault!, wallet, this.chain);
        console.log(allowance)
        if (amountIn > allowance) {
            calls.push(buildCall(v.depositToken, erc20Abi, "approve", [v.vault, maxUint256]));
        }

        calls.push(buildCall(v.vault!, BEEFY_ABI, "deposit", [amountIn]));
        return calls;
    },

    async withdraw(vaultId: string, assets: bigint, wallet: `0x${string}`) {
        const v = this.getVault(vaultId);
        const amountIn = coerceShareAmount(vaultId, assets);
        return [buildCall(v.vault!, BEEFY_ABI, "withdraw", [amountIn, wallet])];
    },
}

export default Beefy;
