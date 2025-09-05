import protocols from "../protocols/index";
import { CHAIN_RPC, getProvider, getShareTokenBalance, getWallet } from "../utils/walletHelper";
// import { performAction } from "./contractInteractor";
import { NETWORKS } from "../../config";
import dotenv from "dotenv";
dotenv.config();
import { executeCallsEthers, getAddressFromMnemonicEthers } from "./contractInteractor";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { parseUnits } from "viem";
import { buildSorSwapCall, buildSorSwapCallWithApproval } from "../utils/swapBuilder";
import { ethers, HDNodeWallet, Mnemonic } from 'ethers';
import { bridgeUSDC } from "./bridge";
import { swap } from "./aggregatedSwap";
const ctx = {
    network: "base" as const,
    mnemonic: process.env.MNEMONIC_ARB!,
    derivationPath: "m/44'/60'/0'/0/0"
};

const main = async () => {
    // const userAddr = getAddressFromMnemonicEthers(ctx);
    const userAddr = HDNodeWallet.fromMnemonic(Mnemonic.fromPhrase(process.env.MNEMONIC_ARB!), "m/44'/60'/0'/0/0").address;
    // console.log("Using wallet:", userAddr);
    // const calls = await protocols.tokemak.deposit("tokemak:USDC", "0.5", userAddr);
    // const calls2 = await protocols.maxapy.deposit("maxapy:USDC", "0.5", userAddr);
    // const calls3 = await protocols.wasabi.deposit("wasabi:USDC", "0.5", userAddr);
    // console.log(calls);
    // console.log(calls2);
    // console.log(calls3);
    // await executeCallsEthers(ctx, calls)
    // await executeCallsEthers(ctx, calls2)
    // await executeCallsEthers(ctx, calls3)



    // Withdraw ALL from Tokemak, Maxapy, Wasabi
    // const tVault = protocols.tokemak.getVault("tokemak:USDC");
    // const wVault = protocols.wasabi.getVault("wasabi:USDC");

    // const [mShares] = await Promise.all([
    //     // getShareTokenBalance(tVault.share, userAddr, protocols.tokemak.chain),
    //     // getShareTokenBalance(wVault.share, userAddr, protocols.wasabi.chain),
    // ]);
    // console.log("tShares", tShares);
    // console.log("wShares", wShares);

    // const tWithdraw = tShares > 0n ? await protocols.tokemak.withdraw("tokemak:USDC", tShares, userAddr) : [];
    // const wWithdraw = wShares > 0n ? await protocols.wasabi.withdraw("wasabi:USDC", wShares, userAddr) : [];

    // if (tWithdraw.length) await executeCallsEthers(ctx, tWithdraw);
    // if (mWithdraw.length) await executeCallsEthers(ctx, mWithdraw);
    // if (wWithdraw.length) await executeCallsEthers(ctx, wWithdraw);


    // await swap("usdc", "usdt", "0.1", {
    //     network: "arbitrum",
    //     slippage: 5,                 // optional (0.30%)
    //     useProviderGasPrice: true,
    // });
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




}

main();
