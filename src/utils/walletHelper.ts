import { ethers } from "ethers";
import { mainnet, arbitrum, base } from "viem/chains";
import { createPublicClient, erc20Abi, erc4626Abi, http } from "viem";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
// import * as ethersV6 from 'ethers-v6';
// Helper to create a provider (from your config or environment)
export function getProvider(rpcUrl: string) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

import { clientByChain } from "./transport";
import { TOKENS } from "../../config";
// Helper to create a wallet (with privateKey and provider)
export function getWallet(mnemonic: string, provider: ethers.JsonRpcProvider) {
  return ethers.Wallet.fromPhrase(mnemonic).connect(provider);
}
export const CHAIN_RPC: Record<string, string> = {
  arbitrum: "https://arb1.arbitrum.io/rpc",
  base: "https://mainnet.base.org",
  ethereum: "https://eth.llamarpc.com",
};

export const CHAIN_OBJECT: Record<string, any> = {
  mainnet,
  arbitrum,
  base,
  // add more as needed
};
/**
 * Get the balance of share tokens for a wallet address
 * @param shareTokenAddress - The address of the share token contract
 * @param walletAddress - The wallet address to check balance for
 * @returns Promise<bigint> - The balance of share tokens
 */
export async function getShareTokenBalance(
  shareTokenAddress: string,
  walletAddress: string,
  chain: string,
): Promise<bigint> {
  const client = (clientByChain as any)[chain];
  return await client.readContract({
    address: shareTokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress as `0x${string}`],
  }) as bigint;
}
export async function getUSDCBalance(
  walletAddress: string,
  chain: string,
): Promise<bigint> {
  if (chain === "solana") {
    const connection = new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
    const owner = new PublicKey(walletAddress);
    const usdcMint = new PublicKey(process.env.SOLANA_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    const ata = await getAssociatedTokenAddress(usdcMint, owner);
    const info = await connection.getAccountInfo(ata);
    if (!info) return 0n;
    const bal = await connection.getTokenAccountBalance(ata);
    return BigInt(bal.value.amount);
  }


  const client = (clientByChain as any)[chain];
  const usdcAddress =
    chain === "arbitrum"
      ? TOKENS.USDC_ARBITRUM.address
      : chain === "base"
        ? TOKENS.USDC.address
        : (() => { throw new Error(`Unsupported chain for USDC: ${chain}`); })();

  return await client.readContract({
    address: usdcAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress as `0x${string}`],
  }) as bigint;
}

export async function getAllowance(
  tokenAddress: string,
  spenderAddress: string,
  walletAddress: string,
  chain: string,
): Promise<bigint> {
  const client = (clientByChain as any)[chain];
  return await client.readContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: [walletAddress as `0x${string}`, spenderAddress as `0x${string}`],
  }) as bigint;
}
export async function previewWithdraw(
  shareTokenAddress: string,
  assets: bigint,
  chain: string,
): Promise<bigint> {
  const client = (clientByChain as any)[chain];

  // Try ERC20 ABI first (in case it's a regular token with custom preview functions)
  try {
    return await client.readContract({
      address: shareTokenAddress as `0x${string}`,
      abi: erc20Abi,
      functionName: "previewWithdraw",
      args: [assets],
    }) as bigint;
  } catch (error) {
    console.log("ERC20 previewWithdraw failed, trying ERC4626...");
    // Fallback to ERC4626 ABI
    return await client.readContract({
      address: shareTokenAddress as `0x${string}`,
      abi: erc4626Abi,
      functionName: "previewWithdraw",
      args: [assets],
    }) as bigint;
  }
}

export async function previewDeposit(
  shareTokenAddress: string,
  amount: bigint,
  chain: string,
): Promise<bigint> {
  const client = (clientByChain as any)[chain];

  //   // Try ERC20 ABI first (in case it's a regular token with custom preview functions)
  //   try {
  //     return await client.readContract({
  //       address: shareTokenAddress as `0x${string}`,
  //       abi: erc20Abi,
  //       functionName: "previewDeposit",
  //       args: [amount],
  //     }) as bigint;
  //   } catch (error) {
  //     console.log("ERC20 previewDeposit failed, trying ERC4626...");
  //     // Fallback to ERC4626 ABI
  //     return await client.readContract({
  //       address: shareTokenAddress as `0x${string}`,
  //       abi: erc4626Abi,
  //       functionName: "previewDeposit",
  //       args: [amount],
  //     }) as bigint;
  //   }
  // }


  // Try ERC20 ABI first (in case it's a regular token with custom preview functions)
  try {
    return await client.readContract({
      address: shareTokenAddress as `0x${string}`,
      abi: erc4626Abi,
      functionName: "previewDeposit",
      args: [amount],
    }) as bigint;
  } catch (error) {
    console.log("ERC4626 previewDeposit failed");
    return 0n;
  }

}



// // Ethers v5 helpers (for Uniswap compatibility)
// export function getProvider(rpcUrl: string) {
//   return new ethers.providers.JsonRpcProvider(rpcUrl);
// }

// export function getWallet(mnemonic: string, provider: ethers.providers.JsonRpcProvider) {
//   return ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
// }

// getUSDCBalance("3y8A3hEKsyRz5B4SxhFHu5Wk3EcnAemWXyqfyasKp7jN", "solana").then(console.log);