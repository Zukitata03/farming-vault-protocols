import Wasabi from "./wasabi";
import Fluid from "./fluid";
import Tokemak from "./tokemak";
import Maxapy from "./maxapy";
import Silo from "./silo";
import Morpho from "./morpho";
import Beefy from "./beefy";

const protocols = {
    wasabi: Wasabi,
    morpho: Morpho,
    fluid: Fluid,
    tokemak: Tokemak,
    maxapy: Maxapy,
    silo: Silo,
    beefy: Beefy,
}

export default protocols;