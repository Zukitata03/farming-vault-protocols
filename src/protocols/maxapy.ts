// // import * as ethersV6 from "ethers-v6";
// import { ethers } from "ethers";
// import type { Protocol, Vault } from "../types/protocol";
// import { MAXAPY_ABI } from "../utils/abis";
// import { vaults } from "../registry/vault.base";
// import { encodeFunctionData } from "viem";
// import { buildCall } from "../utils/callBuilder";
// import { erc20Abi } from "viem";
// import { getShareTokenBalance } from "../utils/walletHelper";
// import { coerceDepositAmount, coerceShareAmount } from "../utils/amount";

// const Maxapy: Protocol = {
//     key: "maxapy",
//     chain: "base",
//     getVault(vaultId: string): Vault {
//         const v = (vaults as any)[vaultId];
//         if (!v) throw new Error(`Vault not found: ${vaultId}`);
//         return {
//             id: vaultId,
//             name: v.name ?? vaultId,
//             router: v.router,
//             vault: v.vault ?? v.router,
//             share: v.share,
//             depositToken: v.depositToken,
//             decimals: v.decimals,
//         };
//     },

//     async deposit(vaultId: string, amount: string | bigint, wallet: `0x${string}`) {
//         const v = this.getVault(vaultId);
//         const amountIn = coerceDepositAmount(vaultId, amount);
//         const approveCall = buildCall(v.depositToken, erc20Abi, "approve", [v.router, amountIn]);
//         const reqDepData = encodeFunctionData({ abi: MAXAPY_ABI, functionName: "requestDeposit", args: [amountIn, wallet as `0x${string}`, wallet as `0x${string}`] });
//         const depData = encodeFunctionData({ abi: MAXAPY_ABI, functionName: "deposit", args: [amountIn, wallet as `0x${string}`] });

//         return [
//             approveCall, buildCall(v.router, MAXAPY_ABI, "multicall", [[reqDepData, depData]]),
//         ];
//     },

//     async withdraw(vaultId: string, shares: string | bigint, wallet: `0x${string}`) {
//         const v = this.getVault(vaultId);
//         const shareTokenBalance = await getShareTokenBalance(v.share, wallet, this.chain);
//         let sharesIn = coerceShareAmount(vaultId, shares);
//         if (sharesIn > shareTokenBalance) {
//             sharesIn = shareTokenBalance;
//         }

//         // const approveData = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [v.router, shares] });
//         // const reqRedeemData = encodeFunctionData({ abi: MAXAPY_ABI, functionName: "requestRedeem", args: [shares, wallet as `0x${string}`, wallet as `0x${string}`] });

//         return [
//             buildCall(v.router, MAXAPY_ABI, "requestRedeem", [shares, wallet as `0x${string}`, wallet as `0x${string}`]),
//         ];
//     },
// }


// export default Maxapy;