import { BrowserProvider, Contract, JsonRpcProvider, formatEther, parseEther, type ContractRunner } from "ethers";
import dep from "./quantapad-deployment.json";
import { QMS_TESTNET } from "./wallet";

export const PORTAL = dep.portal;
export const explorerTx = (h: string) => `${QMS_TESTNET.explorer}/tx/${h}`;

let rp: JsonRpcProvider | null = null;
export const reader = () => (rp ??= new JsonRpcProvider(QMS_TESTNET.rpc, QMS_TESTNET.chainId, { staticNetwork: true }));
export const portal = (r: ContractRunner = reader()) => new Contract(dep.portal, dep.abi.portal, r);
export const token = (a: string, r: ContractRunner = reader()) => new Contract(a, dep.abi.token, r);

export async function getSigner() {
  const eth = (window as unknown as { ethereum?: any }).ethereum;
  if (!eth) throw new Error("No wallet found. Install MetaMask or Rabby.");
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: QMS_TESTNET.chainIdHex }] });
  } catch { /* connect() already offers to add the chain */ }
  return new BrowserProvider(eth).getSigner();
}

export type Meta = { emoji?: string; image?: string; description?: string; website?: string; x?: string; telegram?: string };
export type LiveToken = {
  address: string; name: string; symbol: string; meta: Meta; creator: string;
  buyTaxBps: number; sellTaxBps: number;
  split: { creator: number; burn: number; dividends: number; liquidity: number };
  price: number; marketCap: number; hue: number;
};

const parseMeta = (u: string): Meta => { try { return JSON.parse(u); } catch { return {}; } };
const hueOf = (a: string) => parseInt(a.slice(2, 6), 16) % 360;

export async function loadToken(address: string): Promise<LiveToken | null> {
  const [m, name, symbol, uri] = await Promise.all([portal().markets(address), token(address).name(), token(address).symbol(), token(address).uri()]);
  if (m.creator === "0x0000000000000000000000000000000000000000") return null;
  const price = Number(formatEther(m.vQms)) / Number(formatEther(m.vTok));
  return {
    address, name, symbol, meta: parseMeta(uri), creator: m.creator,
    buyTaxBps: Number(m.buyTaxBps), sellTaxBps: Number(m.sellTaxBps),
    split: { creator: Number(m.split.creator), burn: Number(m.split.burn), dividends: Number(m.split.dividends), liquidity: Number(m.split.liquidity) },
    price, marketCap: price * 1_000_000_000, hue: hueOf(address),
  };
}

export async function loadAll(): Promise<LiveToken[]> {
  const n = Number(await portal().tokenCount());
  const addrs = await Promise.all(Array.from({ length: n }, (_, i) => portal().allTokens(i) as Promise<string>));
  const list = await Promise.all(addrs.reverse().map(loadToken));
  return list.filter((t): t is LiveToken => !!t);
}

export async function launch(a: { name: string; symbol: string; meta: Meta; buyTax: number; sellTax: number; split: LiveToken["split"]; devBuy: string }) {
  const s = await getSigner();
  const tx = await portal(s).createToken(a.name, a.symbol, JSON.stringify(a.meta), a.buyTax, a.sellTax, a.split, { value: parseEther(a.devBuy || "0") });
  const rc = await tx.wait();
  const ev = rc.logs.map((l: any) => { try { return portal().interface.parseLog(l); } catch { return null; } }).find((e: any) => e?.name === "TokenCreated");
  return { hash: tx.hash as string, token: ev?.args.token as string | undefined };
}

export async function quote(addr: string, side: "buy" | "sell", amount: string) {
  const v = parseEther(amount || "0");
  if (v === 0n) return { out: 0, tax: 0 };
  const [out, tax] = side === "buy" ? await portal().quoteBuy(addr, v) : await portal().quoteSell(addr, v);
  return { out: Number(formatEther(out)), tax: Number(formatEther(tax)) };
}

export async function trade(addr: string, side: "buy" | "sell", amount: string, slippagePct = 5) {
  const s = await getSigner();
  const v = parseEther(amount);
  const p = portal(s);
  if (side === "buy") {
    const [out] = await p.quoteBuy(addr, v);
    const tx = await p.buy(addr, (out * BigInt(100 - slippagePct)) / 100n, { value: v });
    await tx.wait(); return tx.hash as string;
  }
  const t = token(addr, s);
  const me = await s.getAddress();
  if ((await t.allowance(me, PORTAL)) < v) await (await t.approve(PORTAL, v)).wait();
  const [out] = await p.quoteSell(addr, v);
  const tx = await p.sell(addr, v, (out * BigInt(100 - slippagePct)) / 100n);
  await tx.wait(); return tx.hash as string;
}

export async function holdings(me: string) {
  const list = await loadAll();
  const rows = await Promise.all(list.map(async (t) => {
    const [bal, claim] = await Promise.all([token(t.address).balanceOf(me), token(t.address).claimable(me)]);
    return { t, bal: Number(formatEther(bal)), claim: Number(formatEther(claim)) };
  }));
  const creatorFees = Number(formatEther(await portal().creatorFees(me)));
  return { rows: rows.filter((r) => r.bal > 0 || r.claim > 0), creatorFees };
}

export async function claimDividends(addr: string) { const s = await getSigner(); const tx = await token(addr, s).claim(); await tx.wait(); return tx.hash as string; }
export async function claimCreator() { const s = await getSigner(); const tx = await portal(s).claimCreatorFees(); await tx.wait(); return tx.hash as string; }

export const errMsg = (e: unknown) => {
  const x = e as { shortMessage?: string; reason?: string; message?: string; code?: string };
  if (x.code === "ACTION_REJECTED") return "Transaction cancelled in wallet.";
  return x.reason ?? x.shortMessage ?? x.message ?? "Transaction failed";
};
