import { PublicKey} from "@solana/web3.js";

export const markets = new Map<string, PublicKey>([
  ["Maple Market", new PublicKey("6WEGfej9B9wjxRs6t4BYpb9iCXd8CpTpJ8fVSNzHCC5y")],
  ["Main Market", new PublicKey("7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF")],
  ["JPL Market", new PublicKey("DxXdAyU3kCjnyggvHmY5nAwg5cRbbmdyX3npfDMjjMek")],
  ["Adrena Market", new PublicKey("CTthJu49dgPkCgu9TKQProuaQnkHsRPQV33sSJ96vxpG")],
  ["Fartcoin Market", new PublicKey("4UwtBqa8DDtcWV6nWFregeMVkGdfWfiYeFxoHaR2hm9c")],
  ["BONK Market", new PublicKey("7WQeTuLsFrZsgnHW7ddFdNfhfJAViqH4mvcFZPQ5zuQ9")],
  ["Bitcoin Market", new PublicKey("GMqmFygF5iSm5nkckYU6tieggFcR42SyjkkhK5rswFRs")],
  ["JTO Market", new PublicKey("9wmqLq3n3KdQBbNfwqrF3PwcLgZ9edZ7hW5TsaC3o6uj")],
  ["Jupiter Market", new PublicKey("3EZEy7vBTJ8Q9PWxKwdLVULRdsvVLT51rpBG3gH1TSJ5")],
  ["Ethena Market", new PublicKey("BJnbcRHqvppTyGesLzWASGKnmnF1wq9jZu6ExrjT7wvF")],
  ["Altcoin Market", new PublicKey("ByYiZxp8QrdN9qbdtaAiePN8AAr3qvTPppNJDpf5DVJ5")],
  ["Apolo Market", new PublicKey("3koBPZPPV4Ag4DPWCyTdAVGxzxABWw9vEZ9vX8sjbbM2")],
]);

export const mints = new Map<string, PublicKey>([
  ["USDC", new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")],
  ["USDT", new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB")],
  ["USDG", new PublicKey("2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH")],
  ["USDS", new PublicKey("USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA")],
  ["FDUSD", new PublicKey("9zNQRsGLjNKwCUU5Gq5LR8beUCPzQMVMqKAi3SSZh54u")],
  ["PYUSD", new PublicKey("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo")],
  // ["EURC", new PublicKey("EGPE45iPkme8G8C1xFDNZoZeHdP3aRYtaAfAQuuwrcGZ")],
  ["USDE", new PublicKey("DEkqHyPN7GMRJ5cArtQFAWefqbZb33Hyf6s5iCwjEonT")],
]);

export const reserves = new Map<string, Map<string, PublicKey>>();
reserves.set("Maple Market", new Map([
  ["USDC", new PublicKey("Atj6UREVWa7WxbF2EMKNyfmYUY1U1txughe2gjhcPDCo")],
  ["USDG", new PublicKey("HokDw9LaDf9qNzJf4F21RjHU3K4pRBkGQENvWnRGyRbn")],
  ["USDS", new PublicKey("BiSRKTadXSiyTSpiqw9nJge33N32AXewUPY7skFJwMvA")],
]));
reserves.set("Main Market", new Map([
  ["USDC", new PublicKey("D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59")],
  ["USDG", new PublicKey("ESCkPWKHmgNE7Msf77n9yzqJd5kQVWWGy3o5Mgxhvavp")],
  ["USDS", new PublicKey("BHUi32TrEsfN2U821G4FprKrR4hTeK4LCWtA3BFetuqA")],
  ["USDT", new PublicKey("H3t6qZ1JkguCNTi9uzVKqQ7dvt2cum4XiXWom6Gn5e5S")],
  // ["EURC", new PublicKey("EGPE45iPkme8G8C1xFDNZoZeHdP3aRYtaAfAQuuwrcGZ")], // Is EURC stablecoin supported?
  ["FDUSD", new PublicKey("Bpc4kAh29J3YDQUMJJdGdr1zBAhTQjC48R1B8YTWudsi")],
  ["PYUSD", new PublicKey("2gc9Dm1eB6UgVYFBUN9bWks6Kes9PbWSaPaa9DqyvEiN")],
]));
reserves.set("JPL Market", new Map([
  ["USDC", new PublicKey("Ga4rZytCpq1unD4DbEJ5bkHeUz9g3oh9AAFEi6vSauXp")],
  ["USDT", new PublicKey("2ov3CMqPBYG3jNBmmpXgK9KMW5GmU5GWZNGcwf7w3BC1")],
  ["PYUSD", new PublicKey("FswUCVjvfAuzHCgPDF95eLKscGsLHyJmD6hzkhq26CLe")],
  ["USDG", new PublicKey("8rM1AY8M4YP4xNVmxhKnEUnj5CRWrcbcHpcgMoDfgqVi")],
]));
reserves.set("Adrena Market", new Map([
  ["USDC", new PublicKey("5bgPMvzZv29jkFEuMwxQRJQf64gKcPfLEEUHhyrP8tce")]
]));
reserves.set("Fartcoin Market", new Map([
  ["USDC", new PublicKey("F22tnLsbv66vEU2GZRc7coaqZsr8UcBbyp9V2kqWAiWK")],
  ["USDT", new PublicKey("FCiu3ZDsyMQXEeLsa3k2P9NnaPtbX8w2RCG9aKL2dnJP")],
]));
reserves.set("BONK Market", new Map([
  ["USDC", new PublicKey("2187ciVuR8fScuGkQYJBtgTjgXFjdKNefafxUSvHjh2T")],
  ["USDT", new PublicKey("5sJpVXsfTUbMD2X8uNMhAYCp83GjcQ7S5NVRn4Ji7qx6")],
  ["USDG", new PublicKey("Adk21h55pWks3hymqA6NpRGpfdptFzXeuyRJ2NHaTqHv")],
])); 
reserves.set("Bitcoin Market", new Map([
  ["USDC", new PublicKey("9FRZvAsjDJ6WM8BJ2S45h9PoDCLAq8DNY9zZDX7MyGzT")],
  ["FDUSD", new PublicKey("F2W8MLCx1aZXUSNvPBuGer4DBBT8W1wMbR8igpimV9wq")],
  ["USDT", new PublicKey("BjZ3HvRJHTNdQDxvJRCgR97Tsgv5ULZtywbiMmmTXycF")],
  ["USDG", new PublicKey("AZJAPDubfJuqzSsdeWQS3EG44nQRpwmKDTG1SKHrEMVy")],
]));
reserves.set("JTO Market", new Map([
  ["USDC", new PublicKey("FZWgLGd8W19eoKZrmRsQPhEhAmyZCjr17NpM7HFCJqb6")],
  ["USDT", new PublicKey("CratMPJswQ6wCWavz6QBK2yVTVZ96RS8rtCwYcMVeaB1")],
  ["USDG", new PublicKey("7hhG1B8G3XNRFZUNM8LrWRiSpAwNNyEx7hcAzpPuCGzh")],
]));
reserves.set("Jupiter Market", new Map([
  ["USDC", new PublicKey("9vUWBVRfowgwoxqdNrDq6Gqu3pUfPxEN9u7mi6639FkG")],
  ["USDT", new PublicKey("BwV7PRfiDNQ7DSA23gmsYL3EZug2jMKR4sXMLTgNBboo")],
  ["USDG", new PublicKey("Gd5WdkCf7ypnydApWUDjUUVPs8yNNXKuhZyrv75WhCbd")],
]));
reserves.set("Ethena Market", new Map([
  ["USDE", new PublicKey("2erD9GTGcaQbLsVSQweg3HvMpfKxScmz95raWv8H4iPN")],
  ["PYUSD", new PublicKey("EDf6dGbVnCCABbNhE3mp5i1jV2JhDAVmTWb1ztij1Yhs")],
]))
reserves.set("Altcoin Market", new Map([
  ["USDC", new PublicKey("9TD2TSv4pENb8VwfbVYg25jvym7HN6iuAR6pFNSrKjqQ")],
]))
reserves.set("Apolo Market", new Map([
  ["USDC", new PublicKey("7fTiUEgY6TkEivLithpChHK7pxrTkC7qgcoCPFyigB4G")],
  ["USDG", new PublicKey("2NhrhA94Fmx9dpEc9FEv3SDwvHheXQuScwhPCJPzg8r3")],
]));

export const reserveFarmStates = new Map<string, Map<string, PublicKey>>();
// The PubKey of all reserve farm states are on curve (meaning they are not derived from a seed).
reserveFarmStates.set("Maple Market", new Map([
  ["USDC", new PublicKey("6Y9fzrWzGZaxdAJ2eWRg9UZpL3kqPDiVXAb67KJpWdUg")],
  ["USDG", new PublicKey("J7YoW8Sr65uDbDoJ8abg2VJTGQ96bwwVaCqd2gunvp35")],
  ["USDS", new PublicKey("35aAYJ31KUuX86ggq1VEbW9fGcWW6phAYbYrFKL4eenB")], // ??? why it's the same as USDG?
]));
reserveFarmStates.set("Main Market", new Map([
  ["USDC", new PublicKey("JAvnB9AKtgPsTEoKmn24Bq64UMoYcrtWtq42HHBdsPkh")], 
  ["USDG", new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD")],  // 13PFMegtPzKi9xPTk6fzDGs6BpgnPUnNZwfXZE1GRt8X
  ["USDS", new PublicKey("67L8BZe5PjuJz5CXqcsp1NXfNHoAZ1qPYUrxT7Cj2iUr")],
  ["USDT", new PublicKey("5pCqu9RFdL6QoN7KK4gKnAU6CjQFJot8nU7wpFK8Zwou")],
  ["FDUSD", new PublicKey("AJi7o8DdUEu9tdMV3wdnZn4gHdcpPMohwebWU3dMZ9rn")], 
  ["PYUSD", new PublicKey("GmJ2vXsDt8R5DNimAZc7Rtphr4oqecBVAx1psaTcVtrX")], 
]));
reserveFarmStates.set("JPL Market", new Map([
  ["USDC", new PublicKey("EGDhupegCXLtonYDSY67c4dzw86S9eMxsntQ1yxWSoHv")], 
  ["USDT", new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD")], 
  ["PYUSD", new PublicKey("6HureeaY2WxT5GNTDvK9zFrHsEMAMJXQ5q4Mm9nYapcP")], 
  ["USDG", new PublicKey("6c7ZLu9SfLSoyCGxa3egiFLHEYBMnHgc2Cz45z8XtDoK")], 
]));
reserveFarmStates.set("Adrena Market", new Map([
  ["USDC", new PublicKey("2aEQ5vxCQzuJd7DQtDtvEUnBpAdWyTNmXswUvNyrf2du")], 
]));
reserveFarmStates.set("Fartcoin Market", new Map([
  ["USDC", new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD")], 
  ["USDT", new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD")], 
]));
reserveFarmStates.set("BONK Market", new Map([
  ["USDC", new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD")], 
  ["USDT", new PublicKey("68YJhNPTss8kjotHxLqKBGW3wemPXFUJXcYPApVz6S7a")], 
  ["USDG", new PublicKey("2EdJeBbXQyRcDioYTgJVr95YsdppyNxwD2U2eKFkUAsm")], 
]));
reserveFarmStates.set("Bitcoin Market", new Map([
  ["USDC", new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD")], 
  ["FDUSD", new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD")], 
  ["USDT", new PublicKey("5hXwbVE6nuHPhgADwDLD2EKf7wgs5N7aMszsYupAPKxW")], 
  ["USDG", new PublicKey("9UKBVzy3onM5vPpUC3mMwTadhWGzj1YX2dimCtwXUVvv")], 
]));
reserveFarmStates.set("JTO Market", new Map([
  ["USDC", new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD")], 
  ["USDT", new PublicKey("6LAeL4asiwHK89FxnoWiKxLseqAYjFhv4VZWaxsH9KTz")], 
  ["USDG", new PublicKey("GSTnd4Cxtm8j9ibQv3rx9x1QcgGcuob26zKqi6vpUsC8")],  
]));
reserveFarmStates.set("Jupiter Market", new Map([
  ["USDC", new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD")], 
  ["USDT", new PublicKey("3qL9odbanz1gJdAxu8snMN7VUbP8uDJnQ5hExiTkrCPz")], 
  ["USDG", new PublicKey("5SToJRWDATd4q46Y9EBrfEemHQv3x3SCeigh5BKKoGoz")], 
]));
reserveFarmStates.set("Ethena Market", new Map([
  ["USDE", new PublicKey("DaSKFFNNWCJ4D6ERQwZ5RsRMTZ1HEZxCEFcHcqQ2QuGU")], 
  ["PYUSD", new PublicKey("CAdMwteM7p6Gj8pEyyk9FbHVZPsAgcyapLWgbreCtmD9")], 
]));
reserveFarmStates.set("Altcoin Market", new Map([
  ["USDC", new PublicKey("23UsLhyeuZBCRJNVFkPrmMCfXuka8hQa8S6spXwTEHcc")], 
]));
reserveFarmStates.set("Apolo Market", new Map([
  ["USDC", new PublicKey("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD")],    
  // ["USDG", new PublicKey("")], // Too new to have depositing transactions, so no farm state yet
]));

export const rewardMints = new Map<string, Map<string, PublicKey>>();
rewardMints.set("Maple Market", new Map([
  ["USDC", new PublicKey("AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj")],
  ["USDG", new PublicKey("AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj")],
  ["USDS", new PublicKey("USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA")],
]));
rewardMints.set("Main Market", new Map([
  ["USDC", new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263")],
  // ["USDG", new PublicKey("")],
  ["USDS", new PublicKey("USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA")],
  ["USDT", new PublicKey("DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263")],
  ["FDUSD", new PublicKey("9zNQRsGLjNKwCUU5Gq5LR8beUCPzQMVMqKAi3SSZh54u")],
  // ["PYUSD", new PublicKey("")],
]));
rewardMints.set("JPL Market", new Map([
  ["USDC", new PublicKey("HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3")],
  // ["USDT", new PublicKey("")],
  ["PYUSD", new PublicKey("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo")],
  ["USDG", new PublicKey("2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH")],
]));
rewardMints.set("Adrena Market", new Map([
  ["USDC", new PublicKey("AuQaustGiaqxRvj2gtCdrd22PBzTn8kM3kEPEkZCtuDw")],
]));
rewardMints.set("Fartcoin Market", new Map([
  // ["USDC", new PublicKey("")],
  // ["USDT", new PublicKey("")],
]));
rewardMints.set("BONK Market", new Map([
  // ["USDC", new PublicKey("")],
  // ["USDT", new PublicKey("")],
  // ["USDG", new PublicKey("")],
]));
rewardMints.set("Bitcoin Market", new Map([
  // ["USDC", new PublicKey("")],
  // ["FDUSD", new PublicKey("")],
  // ["USDT", new PublicKey("")],
  // ["USDG", new PublicKey("")],
]));
rewardMints.set("JTO Market", new Map([
  // ["USDC", new PublicKey("")],
  // ["USDT", new PublicKey("")],
  // ["USDG", new PublicKey("")],
]));
rewardMints.set("Jupiter Market", new Map([ 
  // ["USDC", new PublicKey("")],
  // ["USDT", new PublicKey("")],
  // ["USDG", new PublicKey("")],
]));
rewardMints.set("Ethena Market", new Map([
  // ["USDE", new PublicKey("")],
  ["PYUSD", new PublicKey("2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo")],
]));  
rewardMints.set("Altcoin Market", new Map([
  ["USDC", new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")],
]));
rewardMints.set("Apolo Market", new Map([
  // ["USDC", new PublicKey("")],
  // ["USDG", new PublicKey("")], // Too new to have Depositing transactions, so no reward mint yet
]));
