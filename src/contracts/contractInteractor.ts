import { ethers } from "ethers";
import type { ContractCall } from "../types/protocol";
import { NETWORKS } from "../../config";
import dotenv from "dotenv";
import { CHAIN_RPC, getProvider, getWallet } from "../utils/walletHelper";

export interface ExecContext {
    network: keyof typeof CHAIN_RPC; // e.g. "base" or "arbitrum"
    mnemonic: string;
}


export async function executeCallsEthers(ctx: ExecContext, calls: ContractCall[]) {
    // Create provider & wallet from your helper
    const provider = getProvider(CHAIN_RPC[ctx.network]);
    const wallet = getWallet(ctx.mnemonic, provider);

    const receipts: ethers.TransactionReceipt[] = [];

    for (const c of calls) {
        const iface = new ethers.Interface(c.abi as any);
        const tx = await wallet.sendTransaction({
            to: c.target,
            data: iface.encodeFunctionData(c.method, c.args),
        });
        const receipt = await tx.wait();
        receipts.push(receipt!);
        console.log(`✔ ${ctx.network} ${c.method} → ${receipt?.hash}`);
    }

    return receipts;
}
//     const gasSettings = {
//         maxFeePerGas: ethers.BigNumber.from("10000000000"), // 10 gwei
//         maxPriorityFeePerGas: ethers.BigNumber.from("1000000000"), // 1 gwei  
//         gasLimit: ethers.BigNumber.from("500000"), // 500k gas limit
//     };

//     for (const c of calls) {
//         try {
//             let tx;
//             if (c.data) {
//                 // Raw calldata path (e.g., Uniswap Smart Order Router)
//                 tx = await wallet.sendTransaction({
//                     to: c.target,
//                     data: c.data,
//                     value: c.value ?? 0n,
//                     ...gasSettings,
//                 });
//             } else {
//                 // ABI-encoded path (approve/deposit/withdraw/redeem/etc.)
//                 if (!c.abi || !c.method) {
//                     throw new Error(`Missing abi/method for call to ${c.target}`);
//                 }
//                 const iface = new ethers.utils.Interface(c.abi as any);
//                 tx = await wallet.sendTransaction({
//                     to: c.target,
//                     data: iface.encodeFunctionData(c.method, c.args ?? []),
//                     value: c.value ?? 0n,
//                     ...gasSettings,
//                 });
//             }

//             const receipt = await tx.wait();
//             receipts.push(receipt!);

//             const label = c.method ?? "raw";
//             console.log(`✔ ${ctx.network} ${label} @ ${c.target} → ${receipt?.hash}`);
//         } catch (err: any) {
//             const label = c.method ?? "raw";
//             console.error(`✖ ${ctx.network} ${label} @ ${c.target}:`, err?.reason ?? err?.message ?? err);
//             throw err;
//         }
//     }

//     return receipts;
// }

export function getAddressFromMnemonicEthers(ctx: ExecContext) {
    const provider = getProvider(CHAIN_RPC[ctx.network]);
    const wallet = getWallet(ctx.mnemonic, provider);
    return wallet.address as `0x${string}`;
}