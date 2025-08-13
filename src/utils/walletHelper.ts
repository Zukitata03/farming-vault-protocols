import { ethers } from "ethers";
import { mainnet, arbitrum, base } from "viem/chains";
import { createPublicClient, erc20Abi, erc4626Abi, http } from "viem";
// import * as ethersV6 from 'ethers-v6';
// Helper to create a provider (from your config or environment)
export function getProvider(rpcUrl: string) {
  return new ethers.JsonRpcProvider(rpcUrl);
}

// Helper to create a wallet (with privateKey and provider)
export function getWallet(mnemonic: string, provider: ethers.JsonRpcProvider) {
  return ethers.Wallet.fromPhrase(mnemonic).connect(provider);
}
export const CHAIN_RPC: Record<string, string> = {
  arbitrum: "https://arb1.arbitrum.io/rpc",
  base: "https://mainnet.base.org",
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
  const rpcUrl = CHAIN_RPC[chain];
  const provider = getProvider(rpcUrl);
  const shareTokenContract = new ethers.Contract(shareTokenAddress, erc20Abi, provider);
  const balance = await shareTokenContract.balanceOf(walletAddress);
  return balance;
}
export async function getAllowance(
  tokenAddress: string,
  spenderAddress: string,
  walletAddress: string,
  chain: string,
): Promise<bigint> {
  const rpcUrl = CHAIN_RPC[chain];
  const provider = getProvider(rpcUrl);
  console.log(provider);
  const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, provider);
  const allowance = await tokenContract.allowance(walletAddress, spenderAddress);
  return allowance;
}
export async function previewWithdraw(
  shareTokenAddress: string,
  assets: bigint,
  chain: string,
): Promise<bigint> {
  const rpcUrl = CHAIN_RPC[chain];
  const provider = getProvider(rpcUrl);

  // Try ERC20 ABI first (in case it's a regular token with custom preview functions)
  try {
    const shareTokenContract = new ethers.Contract(shareTokenAddress, erc20Abi, provider);
    const shares = await shareTokenContract.previewWithdraw(assets);
    return shares;
  } catch (error) {
    console.log("ERC20 previewWithdraw failed, trying ERC4626...");
    // Fallback to ERC4626 ABI
    const shareTokenContract = new ethers.Contract(shareTokenAddress, erc4626Abi, provider);
    const shares = await shareTokenContract.previewWithdraw(assets);
    return shares;
  }
}

export async function previewDeposit(
  shareTokenAddress: string,
  amount: bigint,
  chain: string,
): Promise<bigint> {
  const rpcUrl = CHAIN_RPC[chain];
  const provider = getProvider(rpcUrl);

  // Try ERC20 ABI first (in case it's a regular token with custom preview functions)
  try {
    const shareTokenContract = new ethers.Contract(shareTokenAddress, erc20Abi, provider);
    const balance = await shareTokenContract.previewDeposit(amount);
    return balance;
  } catch (error) {
    console.log("ERC20 previewDeposit failed, trying ERC4626...");
    // Fallback to ERC4626 ABI
    const shareTokenContract = new ethers.Contract(shareTokenAddress, erc4626Abi, provider);
    const balance = await shareTokenContract.previewDeposit(amount);
    return balance;
  }
}


// // Ethers v5 helpers (for Uniswap compatibility)
// export function getProvider(rpcUrl: string) {
//   return new ethers.providers.JsonRpcProvider(rpcUrl);
// }

// export function getWallet(mnemonic: string, provider: ethers.providers.JsonRpcProvider) {
//   return ethers.Wallet.fromMnemonic(mnemonic).connect(provider);
// }
