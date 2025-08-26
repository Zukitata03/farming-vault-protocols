import { parseUnits } from "viem";
import { vaults } from "../registry/vault.base";

export function toBigintAmount(value: string | number | bigint, decimals: number): bigint {
    if (typeof value === "bigint") return value;
    return parseUnits(String(value), decimals);
}

export function coerceShareAmount(vaultId: string, value: string | number | bigint): bigint {
    const v = (vaults as any)[vaultId];
    if (!v) throw new Error(`Vault not found: ${vaultId}`);
    const sd = (v.decimals as any)?.share ?? 18;
    return toBigintAmount(value, sd);
}

export function coerceDepositAmount(vaultId: string, value: string | number | bigint): bigint {
    const v = (vaults as any)[vaultId];
    if (!v) throw new Error(`Vault not found: ${vaultId}`);
    const dd = (v.decimals as any)?.deposit ?? 6;
    return toBigintAmount(value, dd);
}