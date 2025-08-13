// import * as ethersV6 from "ethers-v6";
import { ethers } from "ethers";
import type { ContractCall, Protocol, Vault } from "../types/protocol";
import { SILO_ABI_IMPLEMENTATION, SILO_ABI_PROXY, SILO_ABI_SHARE } from "../utils/abis";
import { vaults } from "../registry/vault.base";
import { encodeFunctionData } from "viem";
import { buildCall } from "../utils/callBuilder";
import { erc20Abi, maxUint256 } from "viem";
import { getAllowance, getShareTokenBalance } from "../utils/walletHelper";

const Silo: Protocol = {
    key: "silo",
    chain: "arbitrum",
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

    async deposit(vaultId, amount, wallet) {
        const v = this.getVault(vaultId);
        const allowance = await getAllowance(v.depositToken, v.router, wallet, this.chain);
        console.log("allowance", allowance);
        let approveCall: ContractCall | undefined;
        console.log("amount type", typeof amount);
        console.log("allowance type", typeof allowance);
        if (amount > allowance) {
            console.log("approving max uint256");
            approveCall = buildCall(v.depositToken, erc20Abi, "approve", [v.router, maxUint256]);
        }
        const transferFrom = encodeFunctionData({ abi: SILO_ABI_IMPLEMENTATION, functionName: "transferFrom", args: [v.depositToken, v.router, amount] });
        const approval = encodeFunctionData({ abi: SILO_ABI_IMPLEMENTATION, functionName: "approve", args: [v.depositToken, v.share, amount] });
        const depData = encodeFunctionData({ abi: SILO_ABI_IMPLEMENTATION, functionName: "deposit", args: [v.share, amount, 1] });

        // Only include approveCall if it's defined
        const calls = [];
        if (approveCall) {
            calls.push(approveCall);
        }
        calls.push(buildCall(v.router, SILO_ABI_PROXY, "multicall", [[transferFrom, approval, depData]]));

        return calls;
    },

    async withdraw(vaultId, shares, wallet) {
        const v = this.getVault(vaultId);
        const shareTokenBalance = await getShareTokenBalance(v.share, wallet, this.chain);
        if (shares > shareTokenBalance) {
            shares = shareTokenBalance;
        }

        // const approveData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [v.router, shares] });
        // const reqRedeemData = encodeFunctionData({ abi: MAXAPY_ABI, functionName: "requestRedeem", args: [shares, wallet as `0x${string}`, wallet as `0x${string}`] });

        return [
            buildCall(v.share, SILO_ABI_SHARE, "redeem(uint256,address,address,uint8)", [shares, wallet as `0x${string}`, wallet as `0x${string}`, 1]),
        ];
    },
}


export default Silo;