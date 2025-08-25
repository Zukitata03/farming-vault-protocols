import { VaultDoc } from "./vaultdoc";

export type Allocation = Record<string, number>; // vaultId -> weight (0..1)

export type StrategyParams = {
    kaminoId: string;            // vault id to pin at 20%
    K?: number;                  // default 3
    fixedSafeShare?: number;     // default 0.20
    dynamicPoolShare?: number;   // default 0.80
    maxStalenessHours?: number;  // default 24
    minTvlUsd?: number;          // default 0
    allowOverflowToSafe?: boolean; // default false (keep Kamino exactly 20%)
};

const DEFAULTS: Required<Omit<StrategyParams, "kaminoId">> = {
    K: 3,
    fixedSafeShare: 0.0,
    dynamicPoolShare: 1,
    maxStalenessHours: 168,
    minTvlUsd: 0,
    allowOverflowToSafe: false,
};

const isFresh = (iso?: string | number, maxHrs = 168) => {
    if (!iso) return false;

    // Handle both ISO string and Unix timestamp
    const timestamp = typeof iso === 'string' ? new Date(iso).getTime() : iso * 1000;
    const ageHours = (Date.now() - timestamp) / 36e5;
    return ageHours <= maxHrs;
};

function pickTopKEqual(scores: Array<[string, number]>, K: number) {
    return scores.sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, K)).map(([id]) => id);
}

export function buildAllocationS1(vaults: VaultDoc[], params: StrategyParams): Allocation {
    const cfg = { ...DEFAULTS, ...params };
    const out: Allocation = { [cfg.kaminoId]: cfg.fixedSafeShare };

    const cands = vaults.filter(v =>
        v._id !== cfg.kaminoId &&
        (v.stablecoin ?? true) &&
        isFresh(v.lastUpdatedAt, cfg.maxStalenessHours) &&
        (v.tvlUsd ?? 0) >= cfg.minTvlUsd
    );

    const scores: Array<[string, number]> = cands.map(v => {
        const apy = v.apy ?? 0;
        // const net = apy - (v.managementFee / 100) - (v.performanceFee / 100);
        const net = apy;
        return [v._id, net];
    });

    const top = pickTopKEqual(scores, cfg.K);

    if (top.length === 0) {
        if (cfg.allowOverflowToSafe) out[cfg.kaminoId] = cfg.fixedSafeShare + cfg.dynamicPoolShare;
        return out;
    }

    const per = cfg.dynamicPoolShare / top.length;
    for (const id of top) out[id] = per;
    return out; // sums to 1.0
}