// // FILE: s5.ts
// // Strategy S5: detect cross-sectional regime using CV of smoothed APYs.
// // If stable regime (CV < 0.2) use momentum (EMA(apyLogs,3)); else mean-revert (apyMean30d).
// // 20% fixed in Kamino. Remaining 80% equally split across top K.
// // FILE: s5.ts
// // Strategy S5: detect cross-sectional regime via CV of smoothed APYs.
// //   - If CV < threshold => momentum (EMA(apyLogs,3))
// //   - Else              => mean-revert (apyMean30d)
// // Add a depth tilt using log10(TVL).
// // Sizing is proportional to final score. Optional per-chain caps supported.

// export type VaultDoc = {
//     _id: string;
//     project?: string;
//     chain?: "Base" | "Arbitrum" | "Solana" | string;
//     stablecoin?: boolean;
//     apy?: number;
//     apyMean30d?: number;
//     apyBase7d?: number;
//     apyLogs?: number[];          // most recent last
//     tvlUsd?: number;
//     lastUpdatedAt?: string;
// };

// export type Allocation = Record<string, number>;

// export type StrategyParams = {
//     kaminoId: string;
//     K?: number;                   // default 3
//     fixedSafeShare?: number;      // default 0.20 (set allowOverflowToSafe=true to roll into dynamic)
//     dynamicPoolShare?: number;    // default 0.80
//     maxStalenessHours?: number;   // default 168
//     minTvlUsd?: number;           // default 0
//     allowOverflowToSafe?: boolean;// default false
//     cvThreshold?: number;         // default 0.2
//     depthWeight?: number;         // default 0.30
//     chainCaps?: Record<string, number>; // e.g., { Base: 0.6, Arbitrum: 0.6 }
// };

// const DEFAULTS: Required<Omit<StrategyParams, "kaminoId">> = {
//     K: 3,
//     fixedSafeShare: 0.20,
//     dynamicPoolShare: 0.80,
//     maxStalenessHours: 168,
//     minTvlUsd: 0,
//     allowOverflowToSafe: false,
//     cvThreshold: 0,
//     depthWeight: 0.30,
//     chainCaps: {},
// };

// const isFresh = (iso?: string | number, maxHrs = 168) => {
//     if (!iso) return false;
//     const ts = typeof iso === "string" ? new Date(iso).getTime() : iso * 1000;
//     const ageH = (Date.now() - ts) / 36e5;
//     return ageH <= maxHrs;
// };

// const ema = (series: number[], span = 3) => {
//     if (!series?.length) return undefined;
//     const alpha = 2 / (span + 1);
//     let e = series[0];
//     for (let i = 1; i < series.length; i++) e = alpha * series[i] + (1 - alpha) * e;
//     return e;
// };

// const stdev = (xs: number[]) => {
//     if (!xs?.length) return 0;
//     const m = xs.reduce((a, b) => a + b, 0) / xs.length;
//     const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length;
//     return Math.sqrt(v);
// };

// const zscores = (xs: number[]) => {
//     if (!xs.length) return xs;
//     const m = xs.reduce((a, b) => a + b, 0) / xs.length;
//     const s = stdev(xs);
//     if (s === 0) return xs.map(() => 0);
//     return xs.map(x => (x - m) / s);
// };

// function pickTopKIds(
//     rows: Array<[string, number, number, string]>, // [id, score, tvlUsd, idForTies]
//     K: number
// ) {
//     return rows
//         .sort((a, b) => b[1] - a[1] || b[2] - a[2] || a[3].localeCompare(b[3]))
//         .slice(0, Math.max(1, Math.min(K, rows.length)))
//         .map(([id]) => id);
// }

// function applyChainCaps(
//     weights: Record<string, number>,
//     chainOf: Record<string, string>,
//     caps: Record<string, number>,
//     scores: Record<string, number>,
//     totalShare: number
// ) {
//     const out: Record<string, number> = { ...weights };
//     const EPS = 1e-12;
//     const MAX_ITER = 5;

//     for (let it = 0; it < MAX_ITER; it++) {
//         let overflow = 0;
//         const chainSum = new Map<string, number>();
//         for (const [id, w] of Object.entries(out)) {
//             const ch = chainOf[id] ?? "Unknown";
//             chainSum.set(ch, (chainSum.get(ch) ?? 0) + w);
//         }
//         for (const [ch, cap] of Object.entries(caps)) {
//             const sum = chainSum.get(ch) ?? 0;
//             if (sum > cap + EPS) {
//                 const f = cap / sum;
//                 for (const [id, w] of Object.entries(out)) {
//                     if ((chainOf[id] ?? "Unknown") === ch) {
//                         overflow += w - w * f;
//                         out[id] = w * f;
//                     }
//                 }
//                 chainSum.set(ch, cap);
//             }
//         }

//         const total = Object.values(out).reduce((a, b) => a + b, 0);
//         let need = Math.max(0, totalShare - total);
//         if (overflow <= EPS && need <= EPS) break;
//         if (need <= EPS) break;

//         const chainRemain = new Map<string, number>();
//         for (const [c, cap] of Object.entries(caps)) {
//             chainRemain.set(c, (cap - (chainSum.get(c) ?? 0)));
//         }

//         const eligible = Object.keys(out).filter(id => {
//             const ch = chainOf[id] ?? "Unknown";
//             const cap = caps[ch];
//             if (cap === undefined) return true;
//             const rem = Math.max(0, (chainRemain.get(ch) ?? 0));
//             return rem > EPS;
//         });

//         if (eligible.length === 0) break;

//         const sumScores = eligible.reduce((a, id) => a + Math.max(0, scores[id] ?? 0), 0) || eligible.length;

//         for (const id of eligible) {
//             if (need <= EPS) break;
//             const ch = chainOf[id] ?? "Unknown";
//             const remChain = (caps[ch] === undefined) ? need : Math.max(0, (chainRemain.get(ch) ?? 0));
//             if (remChain <= EPS) continue;
//             const share = Math.max(0, scores[id] ?? 1) / sumScores;
//             const add = Math.min(need * share, remChain);
//             out[id] += add;
//             need -= add;
//             if (caps[ch] !== undefined) chainRemain.set(ch, remChain - add);
//         }

//         if (need <= EPS) break;
//     }
//     return out;
// }

// export function buildAllocationS5(vaults: VaultDoc[], params: StrategyParams): Allocation {
//     const cfg = { ...DEFAULTS, ...params };

//     // safe/dynamic normalization
//     const safeShare = cfg.allowOverflowToSafe ? 0 : cfg.fixedSafeShare;
//     let dynamicShare = cfg.allowOverflowToSafe ? (cfg.fixedSafeShare + cfg.dynamicPoolShare) : cfg.dynamicPoolShare;
//     if (Math.abs(safeShare + dynamicShare - 1) > 1e-9) dynamicShare = 1 - safeShare;

//     const out: Allocation = {};
//     if (safeShare > 0) out[cfg.kaminoId] = safeShare;

//     const cands = vaults.filter(v =>
//         v._id !== cfg.kaminoId &&
//         (v.stablecoin ?? true) &&
//         isFresh(v.lastUpdatedAt, cfg.maxStalenessHours) &&
//         (v.tvlUsd ?? 0) >= cfg.minTvlUsd
//     );
//     if (cands.length === 0) return out;

//     // smoothed APYs for regime detection
//     const smoothed = cands.map(v => {
//         const series = v.apyLogs && v.apyLogs.length >= 3
//             ? v.apyLogs
//             : [v.apyBase7d ?? v.apyMean30d ?? v.apy ?? 0];
//         return ema(series, 3) ?? 0;
//     });
//     const mean = smoothed.reduce((a, b) => a + b, 0) / (smoothed.length || 1);
//     const cv = mean > 0 ? stdev(smoothed) / mean : 0;
//     const useMomentum = cv < cfg.cvThreshold;

//     // carry leg per regime
//     const carryRaw = cands.map((v, i) => (useMomentum ? smoothed[i] : (v.apyMean30d ?? smoothed[i])));

//     // depth = log10(TVL)
//     const depthRaw = cands.map(v => Math.log10(Math.max(1, v.tvlUsd ?? 1)));

//     const zCarry = zscores(carryRaw);
//     const zDepth = zscores(depthRaw);

//     const wDepth = Math.max(0, Math.min(1, cfg.depthWeight));
//     const wCarry = 1 - wDepth;

//     const rows: Array<[string, number, number, string, string]> = cands.map((v, i) => [
//         v._id,
//         wCarry * zCarry[i] + wDepth * zDepth[i], // final score
//         v.tvlUsd ?? 0,
//         v._id,
//         v.chain ?? "Unknown",
//     ]);

//     const K = Math.min(cfg.K, rows.length);
//     const topIds = pickTopKIds(rows.map(([id, s, tvl, tieId]) => [id, s, tvl, tieId]), K);
//     if (topIds.length === 0) return out;

//     const scoreMap: Record<string, number> = {};
//     const chainMap: Record<string, string> = {};
//     for (const [id, s, _tvl, _tie, ch] of rows) {
//         scoreMap[id] = s;
//         chainMap[id] = ch;
//     }

//     const topScores = topIds.map(id => [id, scoreMap[id]] as [string, number]);
//     const sumPos = topScores.reduce((a, [, s]) => a + Math.max(0, s), 0);

//     if (sumPos === 0) {
//         const per = dynamicShare / topIds.length;
//         for (const id of topIds) out[id] = per;
//     } else {
//         for (const [id, s] of topScores) out[id] = dynamicShare * Math.max(0, s) / sumPos;
//     }

//     if (cfg.chainCaps && Object.keys(cfg.chainCaps).length > 0) {
//         const adj = applyChainCaps(out, chainMap, cfg.chainCaps, scoreMap, safeShare + dynamicShare);
//         return adj;
//     }

//     return out;
// }