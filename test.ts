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
// 

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

// import * as anchor from "@coral-xyz/anchor";
// import { Program, Wallet } from "@coral-xyz/anchor";
// import { Jupiter } from "./src/protocols/SolanaProtocols/Jupiter/Jupiter";
// import { Lending } from "/Users/mac/Desktop/Astar Group/Farming_vault_protocols/farming-vault-protocols/src/protocols/SolanaProtocols/Jupiter/target/types/jupiter-lend";
// import fs from 'fs';
// import path from 'path';
// import { Transaction } from "@solana/web3.js";
// import { get } from "http";
// async function main() {
//     let provider = anchor.AnchorProvider.env();
//     const idl = JSON.parse(fs.readFileSync(path.resolve("/Users/mac/Desktop/Astar Group/Farming_vault_protocols/farming-vault-protocols/src/protocols/SolanaProtocols/Jupiter/target/idl/jupiter-lend.json"), 'utf-8')); 
//     const lendingProgram = new Program<Lending>(idl, provider);
//     const jupiter = new Jupiter(
//         lendingProgram,
//         provider,
//     );
//     const depositIxs = await jupiter.deposit(new anchor.BN(1000000));
//     //const withdrawIxs = await jupiter.withdraw(new anchor.BN(1000000));
//     const getPosition = await jupiter.getPosition(1);
//     console.log("getPosition: ", getPosition);
//     // const tx = new Transaction().add(...depositIxs);
//     // const signature = await provider.sendAndConfirm(tx);

//     // console.log("✅ Deposit tx signature:", signature);
// }
// main().catch(console.error);