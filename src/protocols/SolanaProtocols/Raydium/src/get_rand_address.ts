import { PublicKey } from '@solana/web3.js';
export const markets = new Map<string, Map<string, PublicKey>>();
markets.set("USDC", new Map([
    ["USDT", new PublicKey("BZtgQEyS6eXUXicYPHecYQ7PybqodXQMvkjUbP4R8mUU")],
    ["EURC", new PublicKey("2zVV22uNWdJNmkXpj5vCrMzwHGBoJdsyV7qACh29sK1w")],

]));
markets.set("USDG", new Map([
    ["USDC", new PublicKey("7ktmvkDBNwp7vnM6pjtHCemGykDjgH1G4XG6uf83HDqT")] ,
]));
markets.set("USDS", new Map([
    ["USDC", new PublicKey("AS5MV3ear4NZPMWXbCsEz3AdbCaXEnq4ChdaWsvLgkcM")],
]));
markets.set("FDUSD", new Map([
    ["USDC", new PublicKey("4th1WFhr5bP4j2aVTmvzNtutVt2kc91TVfTF1zEvGjHY")],
]));

export const mints = new Map<string, PublicKey>([
  ["USDC", new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")],
  ["USDT", new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")],
  ["USDG", new PublicKey("2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH")],
  ["USDS", new PublicKey("USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA")],
  ["FDUSD", new PublicKey("9zNQRsGLjNKwCUU5Gq5LR8beUCPzQMVMqKAi3SSZh54u")],
  ["USD1", new PublicKey("USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB")],
  ["EURC", new PublicKey("HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr")],
  ["RAY", new PublicKey("4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R")]
]);