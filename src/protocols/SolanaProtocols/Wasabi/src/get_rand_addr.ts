import { PublicKey } from "@solana/web3.js";

export const mints = new Map<string, PublicKey[]>([
    ['USDC', 
        [
            new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'),  // Asset Mint
            new PublicKey('3tMdx4g4grCgqHjELqALfTPnZnG1BLwsPntD3tGREgvp')   // Share Mint
        ]
    ],
]);