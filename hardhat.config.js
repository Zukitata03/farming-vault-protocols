require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.19",
  networks: {
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      chainId: 8453,
    },
    arbitrum: {
      url: process.env.ARB_RPC_URL || "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
    },
  }
};