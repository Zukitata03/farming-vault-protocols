import { ethers } from "ethers";
import type { ContractCall, Protocol, Vault } from "../types/protocol";
import { vaults } from "../registry/vault.base";
import { buildCall } from "../utils/callBuilder";
import { erc20Abi, maxUint256 } from "viem";
import { getAllowance, getShareTokenBalance } from "../utils/walletHelper";
import { WASABI_ABI } from "../utils/abis";


const Wasabi: Protocol = {
    key: "wasabi",
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

        const allowance = await getAllowance(v.depositToken, v.vault, wallet, this.chain);
        if (assets > allowance) {
            calls.push(buildCall(v.depositToken, erc20Abi, "approve", [v.vault, maxUint256]));
        }

        calls.push(buildCall(v.vault, WASABI_ABI, "deposit", [assets, wallet]));
        return calls;
    },

    // Withdraw by ASSETS (USDC). Internally the vault will burn shares.
    async withdraw(vaultId: string, assets: bigint, wallet: `0x${string}`) {
        const v = this.getVault(vaultId);
        return [buildCall(v.vault, WASABI_ABI, "withdraw", [assets, wallet, wallet])];
    },
}


export default Wasabi;