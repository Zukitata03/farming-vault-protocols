export type VaultDoc = {
    _id: string;                      // vault id from DB
    apy?: number;                     // decimal e.g. 0.095
    apyBase?: number;                 // base APY without rewards
    apyBase7d?: number;               // 7-day base APY
    apyBaseInception?: number;        // base APY since inception
    apyMean30d?: number;              // 30-day mean APY
    apyPct1D?: number;                // 1-day APY percentage change
    apyPct30D?: number;               // 30-day APY percentage change
    apyPct7D?: number;                // 7-day APY percentage change
    apyReward?: number;               // reward APY component
    chain?: string;                   // blockchain name
    chain_id?: number;                // blockchain ID
    depositFee?: number;              // deposit fee (decimal)
    exposure?: string;                // exposure type
    il7d?: number;                    // 7-day impermanent loss
    ilRisk?: string;                  // impermanent loss risk level
    isContractAudited?: boolean;      // contract audit status
    isRewardPending?: boolean;        // pending rewards status
    lastUpdatedAt?: string;           // ISO string
    pool?: string;                    // pool identifier
    poolMeta?: any;                   // pool metadata object
    project?: string;                 // protocol/project name
    rewardTokens?: string[];          // array of reward token addresses
    socialRanking?: number;           // social ranking score
    stablecoin?: boolean;             // expect true for all per your setup
    symbol?: string;                  // vault symbol
    tvlUsd?: number;                  // total value locked in USD
    underlyingTokens?: string[];      // array of underlying token addresses
    volumeUsd1d?: number;             // 1-day volume in USD
    volumeUsd7d?: number;             // 7-day volume in USD
    withdrawFee?: number;             // withdrawal fee (decimal)
    withdrawLockPeriod?: number;      // withdrawal lock period
    auditDocumentLink?: string;       // audit document URL
    category?: string;                // vault category
    managementFee?: number;           // decimal e.g. 0.02
    performanceFee?: number;          // decimal e.g. 0.1
    socialLink?: string;              // social media link
    apyLogs?: any[];                  // APY history logs
};