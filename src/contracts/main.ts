import protocols from "../protocols/index";
import { CHAIN_RPC, getProvider, getWallet } from "../utils/walletHelper";
// import { performAction } from "./contractInteractor";
import { NETWORKS } from "../../config";
import dotenv from "dotenv";
dotenv.config();
import { executeCallsEthers, getAddressFromMnemonicEthers } from "./contractInteractor";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { parseUnits } from "viem";
import { buildSorSwapCall, buildSorSwapCallWithApproval } from "../utils/swapBuilder";
import { ethers } from 'ethers';


const ctx = {
    network: "base" as const,
    mnemonic: process.env.MNEMONIC_BASE!,
};

const main = async () => {
    const userAddr = getAddressFromMnemonicEthers(ctx);
    console.log("Using wallet:", userAddr);
    // const calls = await protocols.morpho.deposit("morpho:USDC", parseUnits("0.01", 6), userAddr);
    // await executeCallsEthers(ctx, calls)
    // const calls = await protocols.beefy.deposit("beefy:USDC", parseUnits("0.01", 6), userAddr);
    // await executeCallsEthers(ctx, calls)
    // const calls = await protocols.fluid.deposit("fluid:USDC", parseUnits("100", 6), userAddr);
    // await executeCallsEthers(ctx, calls); 

    // const protocol = protocols.morpho;
    // const vault = protocol.vaults.USDC;
    // const provider = getProvider(CHAIN_RPC[protocol.chain]);
    // const wallet = getWallet(process.env.MNEMONIC!, provider);

    // const tx = await performAction(protocol, vault!, "deposit", "0.01", wallet);
    // console.log(tx);
    // const signedTx = await wallet.sendTransaction(tx);
    // console.log(signedTx);
    // const protocol = protocols.tokemak;
    // const vault = protocol.vaults.baseUSD;
    // const provider = getProvider(CHAIN_RPC[protocol.chain]);
    // const wallet = getWallet(process.env.MNEMONIC!, provider);

    // const tx = await performAction(protocol, vault!, "withdraw", "0.01", wallet);
    // console.log(tx);
    // const signedTx = await wallet.sendTransaction(tx);
    // await signedTx.wait();
    // console.log(signedTx)


    // const publicClient = createPublicClient({
    //   chain: base, // or the correct chain
    //   transport: http("https://mainnet.base.org"), // or your RPC
    // });

    // const result = await publicClient.readContract({
    //   address: "0xc84f7c63742ea1894ee04e5f49fbae8c3a4a734d" as `0x${string}`,
    //   abi: AERODROME_ABI,
    //   functionName: "getAmountOut",
    //   args: [1000000, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"], // fill with actual arguments
    // });

    // console.log("Amount out:", result);

    try {
        const provider = getProvider(CHAIN_RPC.base);
        const chainId = 8453; // Base chain ID

        const swapResult = await buildSorSwapCallWithApproval({
            wallet: userAddr,
            provider: provider,
            chainId,
            tokenIn: {
                address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
                decimals: 6
            },
            tokenOut: {
                address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // WETH on Base
                decimals: 6
            },
            amountIn: parseUnits("0.1", 6), // Swap 10 USDC
            recipient: userAddr,
            slippageBps: 100, // 0.5% slippage
            deadlineSec: 1200 // 20 minutes
        });

        const usdtContract = new ethers.Contract(
            "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
            ["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"],
            provider
        );

        const balance = await usdtContract.balanceOf(userAddr);
        console.log(`USDT Balance: ${ethers.utils.formatUnits(balance, 6)} USDT`);

        const usdcContract = new ethers.Contract(
            "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            ["function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"],
            provider
        );
        const usdcBalance = await usdcContract.balanceOf(userAddr);
        console.log(`USDC Balance: ${ethers.utils.formatUnits(usdcBalance, 6)} USDC`);

        console.log("Swap call generated:");
        console.log("Target:", swapResult.calls[0].target);
        console.log("Data:", swapResult.calls[0].data);
        console.log("Value:", swapResult.calls[0].value);
        console.log("Expected output:", swapResult.expectedOut);
        console.log("Router address:", swapResult.routerAddress);

        // Execute the swap
        await executeCallsEthers(ctx, swapResult.calls);

    } catch (error) {
        console.error("Swap failed:", error);
    }



}

main();
