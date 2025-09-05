import Wasabi from "./wasabi";
import Fluid from "./fluid";
import Tokemak from "./tokemak";
// import Maxapy from "./maxapy";
import Silo from "./silo";
import Morpho from "./morpho";
import Beefy from "./beefy";
import { Kamino } from "./SolanaProtocols/Kamino/src/Kamino";
import { RaydiumCLMM } from "./SolanaProtocols/Raydium/src/RaydiumClmm";
import { Wasabi as Wasabi_solana } from "./SolanaProtocols/Wasabi/src/Wasabi";


const protocols = {
    wasabi: Wasabi,
    morpho: Morpho,
    fluid: Fluid,
    tokemak: Tokemak,
    // maxapy: Maxapy,
    silo: Silo,
    beefy: Beefy,
    kamino: Kamino,
    raydium: RaydiumCLMM,
    wasabi_solana: Wasabi_solana,
}

export default protocols;