import { Address, Abi } from "viem";
export interface Vault {
  id: string;
  name: string;
  // use "router" as the default target (it can be the vault itself for simple protocols)
  router: string;
  vault?: string;          // optional if distinct from router
  share: string;           // share token (or vault token if applicable)
  depositToken: string;    // token user deposits (e.g., USDC)
  decimals: { deposit: number; share: number };
}

export interface Protocol {
  key: string;
  chain: string;
  getVault(vaultId: string): Vault;
  deposit(vaultId: string, amount: bigint | string, wallet: string): Promise<ContractCall[]>;
  withdraw(vaultId: string, shares: bigint | string, wallet: string): Promise<ContractCall[]>;
  claim?(vaultId: string, wallet: string): Promise<ContractCall[]>;
}

export interface ContractCall {
  target: Address;
  abi?: Abi;
  method?: string;
  args?: any[];
  data?: `0x${string}`;
  value?: bigint;

}
