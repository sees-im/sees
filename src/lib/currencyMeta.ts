// Display metadata (icon, label, network) for known NearPayments currency
// codes. Purely cosmetic — the actual list of *available* codes always comes
// live from the NearPayments API (see getContributionCurrencies), so this
// only needs to cover what we want to render nicely. Anything enabled on the
// merchant side but missing here still shows up, just without a custom icon.
const CG = "https://coin-images.coingecko.com/coins/images";

export interface CurrencyMeta {
  label: string;
  network: string;
  icon?: string;
}

function entry(label: string, network: string, icon?: string): CurrencyMeta {
  return { label, network, icon };
}

const btc = entry("Bitcoin", "Bitcoin", `${CG}/1/large/bitcoin.png`);
const eth = entry("Ethereum", "Ethereum", `${CG}/279/large/ethereum.png`);
const tether = (network: string) => entry("Tether", network, `${CG}/325/large/Tether.png`);
const usdc = (network: string) => entry("USD Coin", network, `${CG}/6319/large/USDC.png`);
const bnb = entry("BNB", "BNB Chain", `${CG}/825/large/bnb-icon2_2x.png`);
const pol = entry("Polygon", "Polygon", `${CG}/32440/large/pol.png`);
const arb = entry("Arbitrum", "Arbitrum", `${CG}/16547/large/arb.jpg`);
const op = entry("Optimism", "Optimism", `${CG}/25244/large/Token.png`);
const xpl = entry("Plasma", "Plasma", `${CG}/66489/large/Plasma-symbol-green-1.png`);

export const CURRENCY_META: Record<string, CurrencyMeta> = {
  btc,
  eth,
  sol: entry("Solana", "Solana", `${CG}/4128/large/solana.png`),
  near: entry("NEAR", "NEAR Protocol", `${CG}/10365/large/near.jpg`),
  trx: entry("Tron", "Tron", `${CG}/1094/large/photo_2026-04-13_09-59-16.png`),
  ton: entry("Toncoin", "TON", `${CG}/17980/large/Gram_Circular_Badge.png`),
  xrp: entry("XRP", "XRP Ledger", `${CG}/44/large/xrp-symbol-white-128.png`),
  ada: entry("Cardano", "Cardano", `${CG}/975/large/cardano.png`),
  doge: entry("Dogecoin", "Dogecoin", `${CG}/5/large/dogecoin.png`),
  ltc: entry("Litecoin", "Litecoin", `${CG}/2/large/litecoin.png`),
  zec: entry("Zcash", "Zcash", `${CG}/486/large/circle-zcash-color.png`),
  bch: entry("Bitcoin Cash", "Bitcoin Cash", `${CG}/780/large/bitcoin-cash-circle.png`),
  xlm: entry("Stellar", "Stellar", `${CG}/100/large/fmpFRHHQ_400x400.jpg`),
  sui: entry("Sui", "Sui", `${CG}/26375/large/sui-ocean-square.png`),
  dash: entry("Dash", "Dash", `${CG}/19/large/dash-logo.png`),
  das: entry("Dash", "Dash", `${CG}/19/large/dash-logo.png`),
  avax: entry("Avalanche", "Avalanche", `${CG}/12559/large/Avalanche_Circle_RedWhite_Trans.png`),
  bnb,
  bsc: bnb,
  bnbbsc: bnb,
  matic: pol,
  pol,
  polygon: pol,
  op,
  opeth: op,
  arb,
  etharb: arb,
  base: entry("Ethereum", "Base"),
  ethbase: entry("Ethereum", "Base"),
  xla: entry("XLayer", "X Layer"),
  xlayer: entry("XLayer", "X Layer"),
  pla: xpl,
  xpl,
  usdttrc20: tether("Tron (TRC20)"),
  usdterc20: tether("Ethereum (ERC20)"),
  usdt: tether(""),
  usdc: usdc(""),
  usdcerc20: usdc("Ethereum (ERC20)"),
};

export function metaFor(code: string): CurrencyMeta {
  return CURRENCY_META[code.toLowerCase()] ?? { label: code.toUpperCase(), network: "" };
}
