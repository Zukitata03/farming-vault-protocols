import { ethers } from "ethers";
import type { ContractCall, Protocol, Vault } from "../types/protocol";
import { vaults } from "../registry/vault.base";
import { maxUint256, erc20Abi } from "viem";
import { buildCall } from "../utils/callBuilder";
import { getAllowance } from "../utils/walletHelper";
import { BEEFY_ABI } from "../utils/abis";

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
        const calls: ContractCall[] = [];
        const allowance = await getAllowance(v.depositToken, v.vault!, wallet, this.chain);
        console.log(allowance)
        if (assets > allowance) {
            calls.push(buildCall(v.depositToken, erc20Abi, "approve", [v.vault, maxUint256]));
        }

        calls.push(buildCall(v.vault!, BEEFY_ABI, "deposit", [assets]));
        return calls;
    },

    async withdraw(vaultId: string, assets: bigint, wallet: `0x${string}`) {
        const v = this.getVault(vaultId);
        return [buildCall(v.vault!, BEEFY_ABI, "withdraw", [assets, wallet])];
    },
}

export default Beefy;
