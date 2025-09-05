import { getMedianSlotDurationInMsFromLastEpochs, KaminoMarket, ObligationTypeTag } from "@kamino-finance/klend-sdk";
import { SolanaRpcApiMainnet, Rpc, Address, address, createSolanaRpcApi, DEFAULT_RPC_CONFIG, createDefaultRpcTransport, createRpc } from "@solana/kit";
import { markets } from "./retrieve_rand_addr";
import dotenv from "dotenv";

dotenv.config();

const MAINNET_RPC_URL = process.env.SOLANA_RPC_URL ? process.env.SOLANA_RPC_URL : "https://solana-mainnet.g.alchemy.com/v2/zJJW_aLX9rkL88RgCuiRPHxjR-70jyBz";

interface UserLoansArgs {
  /**
   * web3 connection to your RPC
   */
  rpc: Rpc<SolanaRpcApiMainnet>;
  /**
   * Public Key of the Kamino Market (e.g. main market pubkey: 7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF)
   */
  marketPubkey: Address;
  /**
   * User's wallet public key
   */
  wallet: Address;
}

interface MarketArgs {
  /**
   * web3 connection to your RPC
   */
  rpc: Rpc<SolanaRpcApiMainnet>;
  /**
   * Public Key of the Kamino Market (e.g. main market pubkey: 7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF)
   */
  marketPubkey: Address;
}

async function getMarket({ rpc, marketPubkey }: MarketArgs) {
  const slotDuration = await getMedianSlotDurationInMsFromLastEpochs();
  const market = await KaminoMarket.load(rpc, marketPubkey, slotDuration);
  if (!market) {
    throw Error(`Could not load market ${marketPubkey.toString()}`);
  }
  return market;
}

export function initRpc(rpcUrl: string = MAINNET_RPC_URL): Rpc<SolanaRpcApiMainnet> {
  const api = createSolanaRpcApi<SolanaRpcApiMainnet>({
    ...DEFAULT_RPC_CONFIG,
    defaultCommitment: 'confirmed',
  });
  return createRpc({ api, transport: createDefaultRpcTransport({ url: rpcUrl }) });
}

/**
 * Get all loans for a user wallet
 * @param args
 */
export async function getUserLoansForMarket(args: UserLoansArgs) {
  const market = await getMarket(args);
  return market.getAllUserObligations(args.wallet);
}

async function getUserObligations(market: string, wallet: string) {
  console.time("fetching loans");
  const marketAddress = markets.get(market);
  if (!marketAddress) {
    throw new Error(`Market address for "${market}" not found`);
  }
  const marketPubkey = address(marketAddress.toString());
  const rpc = initRpc();
  const walletPubkey = address(wallet);
  console.log(`fetching all loans for wallet ${wallet.toString()}`);
  const loans = await getUserLoansForMarket({ rpc, marketPubkey, wallet: walletPubkey });
  for (const loan of loans) {
    console.log(
      'loan:',
      loan.obligationAddress.toString(),
      'type:',
      ObligationTypeTag[loan.obligationTag],
      'borrow value:',
      loan.getBorrowedMarketValueBFAdjusted().toNumber(),
      'deposit value:',
      loan.getDepositedValue().toNumber(),
      'net value:',
      loan.getNetAccountValue().toNumber()
    );
  }
  console.timeEnd("fetching loans");
}

getUserObligations("Main Market", "8HNacqZWrKQqe9YTDsiwPyq2y2wqtqjdLXhUgiJDcufH")
  .catch(async (e) => {
    console.error(e);
  });