export type Token = {
  id: string;
  name: string;
  ticker: string;
  emoji: string;
  hue: number;
  creator: string;
  createdMinsAgo: number;
  price: number; // in QMS
  marketCap: number; // in QMS
  volume24h: number;
  holders: number;
  change24h: number;
  buyTaxBps: number;
  sellTaxBps: number;
  split: { creator: number; burn: number; dividends: number; liquidity: number };
  description: string;
};

export const MILESTONE_MCAP = 100_000;

export const TOKENS: Token[] = [
  { id: "qcat", name: "Quantum Cat", ticker: "QCAT", emoji: "🐈", hue: 310, creator: "0x7a3f…91c2", createdMinsAgo: 42, price: 0.0000842, marketCap: 84_200, volume24h: 31_400, holders: 612, change24h: 128.4, buyTaxBps: 300, sellTaxBps: 500, split: { creator: 40, burn: 20, dividends: 30, liquidity: 10 }, description: "Both alive and pumping until observed." },
  { id: "mine", name: "Hashpower", ticker: "MINE", emoji: "⛏️", hue: 60, creator: "0x19be…4a07", createdMinsAgo: 180, price: 0.0000611, marketCap: 61_100, volume24h: 18_900, holders: 401, change24h: 34.1, buyTaxBps: 200, sellTaxBps: 200, split: { creator: 25, burn: 25, dividends: 25, liquidity: 25 }, description: "A tribute to the miners securing QMS." },
  { id: "pad", name: "Launch Frog", ticker: "LFROG", emoji: "🐸", hue: 150, creator: "0xc44d…e8b1", createdMinsAgo: 12, price: 0.0000298, marketCap: 29_800, volume24h: 12_200, holders: 188, change24h: 61.7, buyTaxBps: 100, sellTaxBps: 300, split: { creator: 50, burn: 10, dividends: 20, liquidity: 20 }, description: "Hop on before the next block." },
  { id: "lume", name: "Lumen", ticker: "LUME", emoji: "💡", hue: 90, creator: "0x02aa…7d3e", createdMinsAgo: 520, price: 0.0000187, marketCap: 18_700, volume24h: 4_300, holders: 142, change24h: -12.3, buyTaxBps: 0, sellTaxBps: 400, split: { creator: 30, burn: 40, dividends: 30, liquidity: 0 }, description: "Light speed dividends." },
  { id: "void", name: "Void Whale", ticker: "VOID", emoji: "🐋", hue: 240, creator: "0x88f1…0c55", createdMinsAgo: 64, price: 0.0000143, marketCap: 14_300, volume24h: 7_800, holders: 97, change24h: 18.9, buyTaxBps: 500, sellTaxBps: 500, split: { creator: 20, burn: 30, dividends: 40, liquidity: 10 }, description: "Deep liquidity, deeper lore." },
  { id: "plasma", name: "Plasma", ticker: "PLSM", emoji: "⚡", hue: 280, creator: "0x5e2c…aa19", createdMinsAgo: 5, price: 0.0000061, marketCap: 6_100, volume24h: 2_900, holders: 41, change24h: 240.2, buyTaxBps: 200, sellTaxBps: 600, split: { creator: 40, burn: 20, dividends: 20, liquidity: 20 }, description: "Fresh out of the reactor." },
  { id: "orbit", name: "Orbit Dog", ticker: "ODOG", emoji: "🐕", hue: 20, creator: "0xab90…3f6d", createdMinsAgo: 300, price: 0.0000039, marketCap: 3_900, volume24h: 900, holders: 33, change24h: -4.8, buyTaxBps: 100, sellTaxBps: 100, split: { creator: 60, burn: 0, dividends: 20, liquidity: 20 }, description: "Circling the moon, waiting for launch." },
];

export const getToken = (id: string) => TOKENS.find((t) => t.id === id);
export const kingOfTheHill = () => [...TOKENS].sort((a, b) => b.marketCap - a.marketCap)[0]!;
export const milestonePct = (t: Token) => Math.min(100, (t.marketCap / MILESTONE_MCAP) * 100);

export const fmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toFixed(2);
export const ago = (m: number) => (m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`);

/** Protocol takes 10% of collected tax; the rest follows the creator's 4-way split. */
export const PROTOCOL_CUT = 0.1;
export function splitTax(taxAmount: number, split: Token["split"]) {
  const protocol = taxAmount * PROTOCOL_CUT;
  const rest = taxAmount - protocol;
  return {
    protocol,
    creator: (rest * split.creator) / 100,
    burn: (rest * split.burn) / 100,
    dividends: (rest * split.dividends) / 100,
    liquidity: (rest * split.liquidity) / 100,
  };
}
export const MAX_TAX_BPS = 1000;
