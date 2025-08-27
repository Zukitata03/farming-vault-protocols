import { Raydium } from '@raydium-io/raydium-sdk-v2';
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
import RaydiumClmmIdl from '../target/idl/raydium_clmm.json';
import BN from 'bn.js';
dotenv.config();

interface PositionAccount {
  bump: number;
  nftMint: PublicKey;
  poolId: PublicKey;
  tickLower: number;
  tickUpper: number;
  liquidity: BN;
  feeGrowthInsideLastX64A: BN;
  feeGrowthInsideLastX64B: BN;
  tokenFeesOwedA: BN;
  tokenFeesOwedB: BN;
  rewardInfos: any[];
  ""?: BN[];
}

async function getRaydium(){
    const connection = new Connection(process.env.SOLANA_RPC_URL? process.env.SOLANA_RPC_URL : "https://api.mainnet-beta.solana.com");
    const owner = new PublicKey(process.env.USER_PUBLIC_KEY ? process.env.USER_PUBLIC_KEY : "8HNacqZWrKQqe9YTDsiwPyq2y2wqtqjdLXhUgiJDcufH");

    const raydium = Raydium.load({
        connection,
        owner
    });
    return raydium;
}

async function printPosition(pos: PositionAccount) {
    console.log("📌 Position Account");
    console.log("---------------------------");
    console.log("NFT Mint:", pos.nftMint.toBase58());
    console.log("Pool ID:", pos.poolId.toBase58());
    console.log("Ticks:", `[${pos.tickLower}, ${pos.tickUpper}]`);
    console.log("Liquidity:", pos.liquidity.toString());
    console.log("Fee Growth Inside (Token A):", pos.feeGrowthInsideLastX64A.toString());
    console.log("Fee Growth Inside (Token B):", pos.feeGrowthInsideLastX64B.toString());
    console.log("Token Fees Owed A:", formatBN(pos.tokenFeesOwedA));
    console.log("Token Fees Owed B:", formatBN(pos.tokenFeesOwedB));

    console.log("Reward Infos:");
    pos.rewardInfos.forEach((reward, i) => {
        console.log(`  Reward ${i}:`, JSON.stringify(reward, null, 2));
    });

    if (pos[""] && pos[""].length > 0) {
        console.log("Extra Data:");
        pos[""].forEach((bn, i) => {
        console.log(`  [${i}] = ${bn.toString()}`);
        });
    }
    console.log("---------------------------\n");
}

function formatBN(bn: BN, decimals = 6): string {
    if (bn.isZero()) return "0";
    // Here we just convert to string with optional decimals
    // (if this is token amount, you can pass token decimals instead of 6)
    return bn.div(new BN(10).pow(new BN(decimals))).toString();
}

async function getUserOpenPositions() {
    console.time("getUserOpenPositions");
    const raydium = await getRaydium();
    const Clmm = raydium.clmm;

    const positions: PositionAccount[] = await Clmm.getOwnerPositionInfo({programId: RaydiumClmmIdl.metadata.address});

    positions.forEach(printPosition);
    console.timeEnd("getUserOpenPositions");
}

getUserOpenPositions().catch(console.error);
