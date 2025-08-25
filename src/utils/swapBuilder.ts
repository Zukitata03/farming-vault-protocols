import { AlphaRouter, SwapType } from '@uniswap/smart-order-router';
import { CurrencyAmount, Percent, Token, TradeType } from '@uniswap/sdk-core';
import { ethers } from 'ethers';
import type { Address } from 'viem';
import { erc20Abi, maxUint256 } from 'viem';
import type { ContractCall } from '../types/protocol';
import { getAllowance } from './walletHelper';
import { buildCall } from './callBuilder';

// Build a Uniswap swap (EXACT_INPUT) and return one raw call to the router
export async function buildSorSwapCall(params: {
    provider: ethers.JsonRpcProvider;
    chainId: number;         // 8453 base, 42161 arb
    tokenIn: { address: Address; decimals: number };
    tokenOut: { address: Address; decimals: number };
    amountIn: bigint;        // raw units
    recipient: Address;
    slippageBps?: number;    // default 50 = 0.5%
    deadlineSec?: number;    // from now, default 1200 (20m)
}): Promise<{ call: ContractCall; expectedOut: bigint; routerAddress: Address }> {
    const {
        provider, chainId, tokenIn, tokenOut, amountIn, recipient,
        slippageBps = 100, deadlineSec = 1200
    } = params;


    const router = new AlphaRouter({ chainId, provider: provider as any });
    const tIn = new Token(chainId, tokenIn.address as any, tokenIn.decimals);
    const tOut = new Token(chainId, tokenOut.address as any, tokenOut.decimals);

    const route = await router.route(
        CurrencyAmount.fromRawAmount(tIn, amountIn.toString()),
        tOut,
        TradeType.EXACT_INPUT,
        {
            recipient,
            slippageTolerance: new Percent(slippageBps, 10_000),
            deadline: Math.floor(Date.now() / 1000) + deadlineSec,
            type: SwapType.SWAP_ROUTER_02, // widely supported
        }
    );
    if (!route || !route.methodParameters) {
        throw new Error('SOR could not find a route');
    }

    const { calldata, value, to } = route.methodParameters;
    const expectedOut = BigInt(route.quote.quotient.toString()); // min/expected out before slippage

    return {
        call: {
            target: to as Address,
            data: calldata as `0x${string}`,
            value: BigInt(value ?? '0')
        },
        expectedOut,
        routerAddress: to as Address
    };
}

// Build a Uniswap swap with approval check - returns approval call (if needed) and swap call
export async function buildSorSwapCallWithApproval(params: {
    provider: ethers.JsonRpcProvider;
    chainId: number;         // 8453 base, 42161 arb
    tokenIn: { address: Address; decimals: number };
    tokenOut: { address: Address; decimals: number };
    amountIn: bigint;        // raw units
    recipient: Address;
    wallet: Address;         // wallet address to check allowance for
    slippageBps?: number;    // default 50 = 0.5%
    deadlineSec?: number;    // from now, default 1200 (20m)
}): Promise<{ calls: ContractCall[]; expectedOut: bigint; routerAddress: Address }> {
    const {
        provider, chainId, tokenIn, tokenOut, amountIn, recipient, wallet,
        slippageBps = 100, deadlineSec = 1200
    } = params;

    // First build the swap call to get the router address
    const swapResult = await buildSorSwapCall({
        provider, chainId, tokenIn, tokenOut, amountIn, recipient, slippageBps, deadlineSec
    });

    const calls: ContractCall[] = [];

    // Check allowance and add approval if needed (skip for native ETH)
    const isNativeEth = tokenIn.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
        tokenIn.address.toLowerCase() === '0x0000000000000000000000000000000000000000';

    if (!isNativeEth) {
        // Map chainId to chain name for getAllowance function
        const chainName = getChainName(chainId);
        const allowance = await getAllowance(tokenIn.address, swapResult.routerAddress, wallet, chainName);

        if (amountIn > allowance) {
            // Add approval call for max allowance
            const approveCall = buildCall(
                tokenIn.address,
                erc20Abi,
                "approve",
                [swapResult.routerAddress, maxUint256]
            );
            calls.push(approveCall);
        }
    }

    // Add the swap call
    calls.push(swapResult.call);

    return {
        calls,
        expectedOut: swapResult.expectedOut,
        routerAddress: swapResult.routerAddress
    };
}

// Helper function to map chainId to chain name
function getChainName(chainId: number): string {
    switch (chainId) {
        case 1:
            return 'mainnet';
        case 8453:
            return 'base';
        case 42161:
            return 'arbitrum';
        default:
            throw new Error(`Unsupported chainId: ${chainId}`);
    }
}