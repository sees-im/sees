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
  /**
   * Chain the token settles on, badged onto the corner of `icon`. Only set for
   * tokens that exist on several chains, where the network is what actually
   * distinguishes one row from another.
   */
  networkIcon?: string;
}

function entry(label: string, network: string, icon?: string): CurrencyMeta {
  return { label, network, icon };
}

// Chain artwork, shared between each chain's own row and the corner badge on
// tokens that settle there.
const CHAIN = {
  eth: `${CG}/279/large/ethereum.png`,
  sol: `${CG}/4128/large/solana.png`,
  near: `${CG}/10365/large/near.jpg`,
  trx: `${CG}/1094/large/photo_2026-04-13_09-59-16.png`,
  bnb: `${CG}/825/large/bnb-icon2_2x.png`,
  pol: `${CG}/32440/large/pol.png`,
  xpl: `${CG}/66489/large/Plasma-symbol-green-1.png`,
  // Base has no coin of its own, so this comes from CoinGecko's asset-platform
  // artwork rather than the coin images used above.
  base: "https://coin-images.coingecko.com/asset_platforms/images/131/large/base.png",
};

const btc = entry("Bitcoin", "Bitcoin", `${CG}/1/large/bitcoin.png`);
const eth = entry("Ethereum", "Ethereum", CHAIN.eth);
const tether = (network: string, networkIcon: string): CurrencyMeta => ({
  ...entry("Tether", network, `${CG}/325/large/Tether.png`),
  networkIcon,
});
const usdc = (network: string, networkIcon: string): CurrencyMeta => ({
  ...entry("USD Coin", network, `${CG}/6319/large/USDC.png`),
  networkIcon,
});
const bnb = entry("BNB", "BNB Chain", CHAIN.bnb);
const pol = entry("Polygon", "Polygon", CHAIN.pol);
const arb = entry("Arbitrum", "Arbitrum", `${CG}/16547/large/arb.jpg`);
const op = entry("Optimism", "Optimism", `${CG}/25244/large/Token.png`);
const xpl = entry("Plasma", "Plasma", CHAIN.xpl);

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
  base: { ...entry("Ethereum", "Base", CHAIN.eth), networkIcon: CHAIN.base },
  ethbase: { ...entry("Ethereum", "Base", CHAIN.eth), networkIcon: CHAIN.base },
  xla: entry("XLayer", "X Layer"),
  xlayer: entry("XLayer", "X Layer"),
  pla: xpl,
  xpl,
  usdt: entry("Tether", "", `${CG}/325/large/Tether.png`),
  usdc: entry("USD Coin", "", `${CG}/6319/large/USDC.png`),
  // Stablecoins, one entry per accepted chain. NearPayments exposes two codes
  // for some networks (usdterc20/usdteth, usdtbep20/usdtbsc, usdttrc20/usdttrx);
  // only one of each pair is offered so the picker doesn't show what looks like
  // a duplicate row — but both are labelled here in case the other is enabled.
  usdterc20: tether("Ethereum (ERC20)", CHAIN.eth),
  usdteth: tether("Ethereum (ERC20)", CHAIN.eth),
  usdttrc20: tether("Tron (TRC20)", CHAIN.trx),
  usdttrx: tether("Tron (TRC20)", CHAIN.trx),
  usdtbep20: tether("BNB Chain (BEP20)", CHAIN.bnb),
  usdtbsc: tether("BNB Chain (BEP20)", CHAIN.bnb),
  usdtpol: tether("Polygon", CHAIN.pol),
  usdtnear: tether("NEAR Protocol", CHAIN.near),
  usdtsol: tether("Solana", CHAIN.sol),
  usdt0plasma: tether("Plasma", CHAIN.xpl),
  usdcerc20: usdc("Ethereum (ERC20)", CHAIN.eth),
  usdceth: usdc("Ethereum (ERC20)", CHAIN.eth),
  usdcbep20: usdc("BNB Chain (BEP20)", CHAIN.bnb),
  usdcbsc: usdc("BNB Chain (BEP20)", CHAIN.bnb),
  usdcpol: usdc("Polygon", CHAIN.pol),
  usdcbase: usdc("Base", CHAIN.base),
  usdcnear: usdc("NEAR Protocol", CHAIN.near),
  usdcsol: usdc("Solana", CHAIN.sol),
};

export function metaFor(code: string): CurrencyMeta {
  return CURRENCY_META[code.toLowerCase()] ?? { label: code.toUpperCase(), network: "" };
}
