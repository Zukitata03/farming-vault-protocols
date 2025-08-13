import type { Abi, Address } from "viem";
import type { ContractCall } from "../types/protocol";

export function buildCall(target: Address, abi: Abi, method: string, args: any[]): ContractCall {
    return { target, abi, method, args };
}