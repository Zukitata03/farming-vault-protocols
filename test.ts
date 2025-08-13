// // scripts/farming.js
// import { ethers } from "ethers";
// import { WasabiProtocol } from "./ProtocolClass.ts";
// require('dotenv').config();
// // import {WASABI_ABI} from './config';

// // --- CONFIGURATION ---
// const MNEMONIC = process.env.MNEMONIC;
// const WASABI_CONTRACT_ADDRESS = "0x1C4a802FD6B591BB71dAA01D8335e43719048B24";
// const RPC_URL = "https://mainnet.base.org";





// // --- Example usage ---
// async function main() {
//     // Example input
//     const input = {
//         token: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // not used directly in this contract, but included for extensibility
//         amount: ethers.parseUnits("0.01", 6), // 10 USDC (6 decimals)
//     };

//     // Example addresses (replace with actual addresses)
//     const receiver = "0x688a38F2AA707f087cb67E92DeD8c3Bdbaa73A4e";
//     const owner = "0x688a38F2AA707f087cb67E92DeD8c3Bdbaa73A4e";

//     const provider = new ethers.JsonRpcProvider(RPC_URL);
//     const protocol = new WasabiProtocol(WASABI_CONTRACT_ADDRESS, WASABI_ABI, provider);
//     const wallet = ethers.Wallet.fromPhrase(MNEMONIC!).connect(provider);
//     const unsignedTx = await protocol.getDepositTx({
//         token: input.token,
//         amount: input.amount.toString(),
//         receiver,
//     });
//     const txResponse = await wallet.sendTransaction(unsignedTx);
//     console.log("Tx hash:", txResponse.hash);
    
    
//     // // // Get unsigned deposit tx
//     // const depositTx = await protocol.getDepositTx({
//     //     token: input.token,
//     //     amount: input.amount,
//     //     receiver,
//     // });
//     // console.log("Unsigned deposit tx:", depositTx);

//     // console.log(depositTx);

//     // // Get unsigned withdraw tx
//     // const withdrawTx = await protocol.getWithdrawTx({
//     //     token: input.token,
//     //     amount: input.amount,
//     //     receiver,
//     //     owner,
//     // });
//     // console.log("Unsigned withdraw tx:", withdrawTx);
// }

// main().catch(console.error);