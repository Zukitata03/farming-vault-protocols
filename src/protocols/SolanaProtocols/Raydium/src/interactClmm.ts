import {Program, AnchorProvider} from "@project-serum/anchor";
import {Connection, PublicKey} from "@solana/web3.js";
import * as anchor from '@coral-xyz/anchor';
import * as fs from 'fs';
import Decimal from "decimal.js";

import RaydiumClmmIdl from '../target/idl/raydium_clmm.json';
import { RaydiumCLMM } from "./RaydiumClmm";

const wallet = anchor.web3.Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync('phantom-mainnet-keypair.json', 'utf8')))
);
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const provider = new AnchorProvider(connection, new anchor.Wallet(wallet), {
  commitment: 'confirmed',
});

const clmmProgram = new Program(RaydiumClmmIdl as any, RaydiumClmmIdl.metadata.address, provider);
const clmm = new RaydiumCLMM(
  clmmProgram, 
  provider, 
  "USDS", // token0 symbol
  "USDC", // token1 symbol
  // new PublicKey("733H2N9rpVrGYuqdWBFtz9f5xVabq7iWmwzW9HZc1wpZ"), // address of nft mint if exists, should be stored in database
);

async function deposit(
  amount0: Decimal,
  amount1: Decimal
) {
  console.log("Should open position with nft");
  const instructions = await clmm.deposit(
    new Decimal(amount0),
    new Decimal(amount1)
  ); // eg: 3 USDS, 0.1 USDC
  const transaction = new anchor.web3.Transaction().add(...instructions);
  
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  let signers = [wallet];
  if (clmm.nft_key_pair) {
    signers.push(clmm.nft_key_pair);
  }

  let signature = await provider.sendAndConfirm(transaction, signers);
  console.log("✅ Transaction successful! Signature:", signature);
}

async function increaseLiquidity(
  liquidity: anchor.BN,
  amount0Max: anchor.BN,
  amount1Max: anchor.BN
) {
  console.log("Should increase liquidity");

  const instructions = await clmm.increaseLiquidityV2(
    liquidity,
    amount0Max,
    amount1Max
  ); // eg: new anchor.BN(40000000), new anchor.BN(20000), new anchor.BN(30000),
  const transaction = new anchor.web3.Transaction().add(...instructions);
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  let signers = [wallet];

  let signature = await provider.sendAndConfirm(transaction, signers);
  console.log("✅ Transaction successful! Signature:", signature);
}

async function decreaseLiquidity(
  liquidity: anchor.BN,
  amount0Min: anchor.BN,
  amount1Min: anchor.BN
) {
  console.log("Should decrease liquidity");

  const instructions = await clmm.decreaseLiquidityV2(
    liquidity,
    amount0Min,
    amount1Min
  ); // eg: new anchor.BN(110000000), new anchor.BN(30000), new anchor.BN(70000)
  // or: new anchor.BN(personalPositionState.liquidity), new anchor.BN(0), new anchor.BN(0) to withdraw all liquidity
  const transaction = new anchor.web3.Transaction().add(...instructions);
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  let signers = [wallet];

  let signature = await provider.sendAndConfirm(transaction, signers);
  console.log("✅ Transaction successful! Signature:", signature);
}

async function claimRewards() {
  console.log("should claim rewards");

  // Claim rewards by inputing (0,0,0) to decreaseLiquidityV2
  const instructions = await clmm.decreaseLiquidityV2(
    new anchor.BN(0),
    new anchor.BN(0),
    new anchor.BN(0),
  );
  const transaction = new anchor.web3.Transaction().add(...instructions);
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  let signers = [wallet];

  let signature = await provider.sendAndConfirm(transaction, signers);
  console.log("✅ Transaction successful! Signature:", signature);
}

async function closePosition() {
  console.log("Should close position");
  const instructions = await clmm.closePosition();
  const transaction = new anchor.web3.Transaction().add(...instructions);
  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  let signers = [wallet];

  let signature = await provider.sendAndConfirm(transaction, signers);
  console.log("✅ Transaction successful! Signature:", signature);
}

(async () => {
  console.log("Raydium CLMM Interaction");
  // add your logic here
  // Example: Deposit
  // await deposit(
  //   new Decimal(3000000),  // amount0
  //   new Decimal(100000)  // amount1
  // )

  await decreaseLiquidity(
    new anchor.BN(200000000),
    new anchor.BN(0),
    new anchor.BN(0)
  )
})().catch(err => {
  console.error("Error during CLMM interaction:", err);
  process.exit(1);
});
