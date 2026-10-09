import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { loadToken, quote, trade, errMsg, explorerTx, token as tokenC } from "@/lib/chain";
import { LiveAvatar } from "@/components/live-avatar";
import { useWallet, short, QMS_TESTNET } from "@/lib/wallet";
import { fmt, splitTax } from "@/lib/tokens";
import { formatEther } from "ethers";

export function LiveTokenPage({ address }: { address: string }) {
  const qc = useQueryClient();
  const { address: me, connect } = useWallet();
  const { data: t, isLoading } = useQuery({ queryKey: ["live", address], queryFn: () => loadToken(address), refetchInterval: 15000 });
  const { data: bal } = useQuery({ queryKey: ["bal", address, me], enabled: !!me, queryFn: async () => Number(formatEther(await tokenC(address).balanceOf(me!))) });
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState("0.01");
  const [q, setQ] = useState({ out: 0, tax: 0 });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; hash?: string } | null>(null);

  useEffect(() => {
    let live = true;
    const id = setTimeout(() => quote(address, side, amt).then((r) => live && setQ(r)).catch(() => live && setQ({ out: 0, tax: 0 })), 300);
    return () => { live = false; clearTimeout(id); };
  }, [address, side, amt, t]);

  if (isLoading) return <p className="py-24 text-center text-muted-foreground">Loading token from QMS Testnet…</p>;
  if (!t) return <p className="py-24 text-center">Token not found on Quantapad.</p>;
  const parts = splitTax(q.tax, t.split);

  async function go() {
    setBusy(true); setMsg(null);
    try {
      const hash = await trade(address, side, amt);
      setMsg({ ok: true, text: `${side === "buy" ? "Bought" : "Sold"} ${t!.symbol}.`, hash });
      qc.invalidateQueries({ queryKey: ["live", address] }); qc.invalidateQueries({ queryKey: ["bal", address] });
    } catch (e) { setMsg({ ok: false, text: errMsg(e) }); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <LiveAvatar t={t} size={64} />
          <div>
            <h1 className="text-2xl font-bold">{t.name} <span className="font-mono text-base text-muted-foreground">${t.symbol}</span></h1>
            <p className="font-mono text-xs text-muted-foreground">by {short(t.creator)} · <a className="underline" href={`${QMS_TESTNET.explorer}/address/${t.address}`} target="_blank" rel="noreferrer">{short(t.address)}</a></p>
          </div>
        </div>
        {t.meta.description && <p className="text-muted-foreground">{t.meta.description}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[["Price", `${t.price.toPrecision(4)} QMS`], ["Market cap", `${fmt(t.marketCap)} QMS`], ["Your balance", me ? `${fmt(bal ?? 0)} ${t.symbol}` : "—"]].map(([l, v]) => (
            <div key={l} className="glass rounded-xl p-3"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className="font-mono text-sm font-bold">{v}</p></div>
          ))}
        </div>
        <div className="glass rounded-xl p-4">
          <h2 className="mb-3 text-sm font-bold">Tax & revenue split</h2>
          <p className="mb-3 text-sm text-muted-foreground">Buy tax {t.buyTaxBps / 100}% · Sell tax {t.sellTaxBps / 100}%. Quantapad keeps 10% of tax; the rest is split:</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(t.split).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted p-2 text-center"><p className="text-[11px] capitalize text-muted-foreground">{k}</p><p className="font-mono font-bold">{v}%</p></div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Liquidity is permanently locked in the Quantapad Portal.</p>
        </div>
      </div>

      <aside className="glass h-fit rounded-2xl p-5 lg:sticky lg:top-24">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-full border p-1">
          {(["buy", "sell"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)} className={`rounded-full py-1.5 text-sm font-bold capitalize ${side === s ? (s === "buy" ? "bg-success text-primary-foreground" : "bg-destructive text-destructive-foreground") : "text-muted-foreground"}`}>{s}</button>
          ))}
        </div>
        <label className="flex justify-between text-xs text-muted-foreground">
          <span>Amount ({side === "buy" ? "QMS" : t.symbol})</span>
          {side === "sell" && me && bal ? <button type="button" className="text-primary" onClick={() => setAmt(String(bal))}>Max</button> : null}
        </label>
        <input className="field mt-1 font-mono" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <div className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
          <Row l={`Tax (${(side === "buy" ? t.buyTaxBps : t.sellTaxBps) / 100}%)`} v={`${q.tax.toPrecision(3)} QMS`} />
          <Row l="→ Protocol" v={parts.protocol.toPrecision(3)} />
          <Row l="You receive ≈" v={side === "buy" ? `${fmt(q.out)} ${t.symbol}` : `${q.out.toPrecision(4)} QMS`} />
          <Row l="Max slippage" v="5%" />
        </div>
        <button className="btn-primary mt-5 w-full py-3" disabled={busy || (!!me && q.out <= 0)} onClick={me ? go : connect}>
          {busy ? "Confirm in wallet…" : me ? `${side === "buy" ? "Buy" : "Sell"} ${t.symbol}` : "Connect wallet"}
        </button>
        {msg && (
          <p className={`mt-3 text-sm ${msg.ok ? "text-success" : "text-destructive"}`}>
            {msg.text} {msg.hash && <a className="underline" href={explorerTx(msg.hash)} target="_blank" rel="noreferrer">View tx</a>}
          </p>
        )}
      </aside>
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return <div className="flex justify-between gap-2"><span>{l}</span><span className="text-right text-foreground">{v}</span></div>;
}
