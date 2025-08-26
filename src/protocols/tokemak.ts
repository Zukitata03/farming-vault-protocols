import { ethers } from "ethers";
import type { ContractCall, Protocol, Vault } from "../types/protocol";
import { TOKEMAK_ABI, TOKEMAK_ROUTER_ABI } from "../utils/abis";
import { vaults } from "../registry/vault.base";
import { encodeFunctionData } from "viem";
import { buildCall } from "../utils/callBuilder";
import { erc20Abi, maxUint256 } from "viem";
import { getAllowance, getShareTokenBalance } from "../utils/walletHelper";
import { previewDeposit } from "../utils/walletHelper";
import { coerceShareAmount, coerceDepositAmount } from "../utils/amount";

const Tokemak: Protocol = {
    key: "tokemak",
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
    async deposit(vaultId, amount, wallet) {
        const v = this.getVault(vaultId);
        // const allowance = await getAllowance(v.depositToken, v.router, wallet, this.chain);
        // console.log("allowance", allowance);
        // let approveCall: ContractCall | undefined;
        // console.log("amount type", typeof amount);
        // console.log("allowance type", typeof allowance);
        // if (amount > allowance) {
        //     console.log("approving max uint256");
        //     approveCall = buildCall(v.depositToken, erc20Abi, "approve", [v.router, maxUint256]);
        // }
        const amountIn = coerceDepositAmount(vaultId, amount);
        const slippageBps = 50;
        const BPS = 10000n;
        const exptectedShares = await previewDeposit(v.share, amountIn, this.chain);
        const MIN_SHARES_OUT = exptectedShares * (BPS - BigInt(slippageBps)) / BPS;
        console.log("MIN_SHARES_OUT", MIN_SHARES_OUT);
        const pullToken = encodeFunctionData({ abi: TOKEMAK_ABI, functionName: "pullToken", args: [v.depositToken, amountIn, v.router] });
        const approval = encodeFunctionData({ abi: TOKEMAK_ABI, functionName: "approve", args: [v.depositToken, v.share, amountIn] });
        const depData = encodeFunctionData({ abi: TOKEMAK_ABI, functionName: "deposit", args: [v.share, wallet as `0x${string}`, amountIn, MIN_SHARES_OUT] });

        // Only include approveCall if it's defined
        const calls = [];
        // if (approveCall) {
        //     calls.push(approveCall);
        // }
        calls.push(buildCall(v.router, TOKEMAK_ABI, "multicall", [[pullToken, approval, depData]]));

        return calls;
    },

    async withdraw(vaultId, shares, wallet) {
        const v = this.getVault(vaultId);
        const shareTokenBalance = await getShareTokenBalance(v.share, wallet, this.chain);
        let sharesIn = coerceShareAmount(vaultId, shares);
        if (sharesIn > shareTokenBalance) {
            sharesIn = shareTokenBalance;
        }
        // const calls = [];
        // const approveCall = encodeFunctionData({ abi: TOKEMAK_ROUTER_ABI, functionName: "approve", args: [v.share, v.router, shares] });
        // // console.log("shares", shares);
        // // const approveData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [v.router, shares] });
        // // const reqRedeemData = encodeFunctionData({ abi: MAXAPY_ABI, functionName: "requestRedeem", args: [shares, wallet as `0x${string}`, wallet as `0x${string}`] });
        // const redeemCall = encodeFunctionData({ abi: TOKEMAK_ROUTER_ABI, functionName: "redeem", args: [v.vault as `0x${string}`, wallet as `0x${string}`, shares, 1n] });
        // calls.push(buildCall(v.router, TOKEMAK_ROUTER_ABI, "multicall", [[approveCall, redeemCall]]));
        // return calls;
        const approve = buildCall(
            v.share as `0x${string}`,
            erc20Abi as any,
            "approve",
            [v.router as `0x${string}`, sharesIn]
        );
        const redeem = buildCall(
            v.vault as `0x${string}`,
            TOKEMAK_ROUTER_ABI as any,
            "redeem",
            [v.share as `0x${string}`, wallet as `0x${string}`, sharesIn, 1n]
        );
        return [approve, redeem];
    },
}

// const Tokemak: Protocol = {
//     name: "Tokemak",
//     chain: "base",
//     vaults: {
//         "baseUSD": {
//             name: "Stable Vault",
//             address: "0x4D2b87339b1f9e480aA84c770fa3604D7D40f8DF",
//             abi: TOKEMAK_ABI,
//             decimals: 6,
//             depositFunc: "multicall",
//             withdrawFunc: "multicall",
//             depositCalls: [
//                 {
//                     functionName: "pullToken",
//                     args: [
//                         "{{USDC_ADDRESS}}",
//                         "{{AMOUNT}}",
//                         "{{VAULT_ADDRESS}}" //recipent address
//                     ]
//                 },
//                 {
//                     functionName: "approve",
//                     args: [
//                         "{{USDC_ADDRESS}}",
//                         "{{baseUSD_ADDRESS}}",// tokemak usd address
//                         "{{AMOUNT}}",
//                     ]
//                 },
//                 {
//                     functionName: "deposit",
//                     args: [
//                         "{{baseUSD_ADDRESS}}",
//                         "{{USER_ADDRESS}}",
//                         "{{AMOUNT}}",
//                         "{{MIN_SHARES_OUT}}",
//                     ]
//                 },
//             ],
//             withdrawCalls: [
//                 // {
//                 //     functionName: "selfPermit",
//                 //     args: [
//                 //         "{{baseUSD_ADDRESS}}",
//                 //         "{{REDEEM_AMOUNT}}",
//                 //         "{{DEADLINE}}",
//                 //         "{{PERMIT_V}}",
//                 //         "{{PERMIT_R}}",
//                 //         "{{PERMIT_S}}",
//                 //     ]
//                 // },
//                 // {
//                 //     functionName: "approve",
//                 //     args: [
//                 //         "{{baseUSD_ADDRESS}}",
//                 //         "{{VAULT_ADDRESS}}",
//                 //         "{{REDEEM_AMOUNT}}",
//                 //     ]
//                 // },

//                 {
//                     functionName: "redeem",
//                     args: [
//                         "{{baseUSD_ADDRESS}}", // vault address
//                         "{{USER_ADDRESS}}",
//                         "{{REDEEM_AMOUNT}}",
//                         "{{MIN_AMOUNT_OUT}}",
//                     ]
//                 },
//             ],
//         }
//     }
// }


export default Tokemak; 