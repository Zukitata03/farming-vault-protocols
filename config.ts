export const NETWORKS = {
	arbitrum: {
		rpcUrl: "https://arb1.arbitrum.io/rpc",
		chainId: 42161,
	},
	base: {
		rpcUrl: "https://mainnet.base.org",
		chainId: 8453,
	},
	// Add other networks if you use them
};

export const TOKENS = {
	USDC: {
		decimals: 6,
		address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
	},
	USDC_ARBITRUM: {
		decimals: 6,
		address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
	},
};
export const MORPHO_BUNDLER_SENTINEL =
	"0x00000000000000000000000000000000BUNDL3R" as `0x${string}`;
