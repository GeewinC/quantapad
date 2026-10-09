import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getToken, fmt, ago, splitTax } from "@/lib/tokens";
import { TokenAvatar, Progress, Change } from "@/components/shell";
import { useWallet } from "@/lib/wallet";
import { LiveTokenPage } from "@/components/live-token";
import type { Token } from "@/lib/tokens";

export const Route = createFileRoute("/token/$id")({
  loader: ({ params }) => {
    if (/^0x[0-9a-fA-F]{40}$/.test(params.id)) return { token: null as Token | null, live: params.id };
    const token = getToken(params.id);
    if (!token) throw notFound();
    return { token: token as Token | null, live: null as string | null };
  },
  head: ({ loaderData }) =>
    loaderData?.live
      ? { meta: [{ title: "Token on Quantapad" }, { name: "description", content: "Trade this token on Quantapad, QMS Testnet." }, { property: "og:title", content: "Token on Quantapad" }, { property: "og:description", content: "Trade on Quantapad, QMS Testnet." }] }
      : loaderData?.token
      ? { meta: [
          { title: `${loaderData.token!.name} ($${loaderData.token!.ticker}) — Quantapad` },
          { name: "description", content: `${loaderData.token!.description} Trade on Quantapad.` },
          { property: "og:title", content: `${loaderData.token!.name} on Quantapad` },
          { property: "og:description", content: loaderData.token!.description },
        ] }
      : { meta: [{ title: "Token not found — Quantapad" }, { name: "robots", content: "noindex" }] },
  notFoundComponent: () => (
    <div className="py-24 text-center"><h1 className="text-2xl font-bold">Token not found</h1><Link to="/" className="btn-ghost mt-4">Back to Explore</Link></div>
  ),
  component: TokenPage,
});

function TokenPage() {
  const { token, live } = Route.useLoaderData();
  if (live) return <LiveTokenPage address={live} />;
  return <SampleTokenPage t={token!} />;
}

function SampleTokenPage({ t }: { t: Token }) {
  const { address, connect } = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState("1");
  const n = parseFloat(amt) || 0;
  const taxBps = side === "buy" ? t.buyTaxBps : t.sellTaxBps;
  const tax = (n * taxBps) / 10_000;
  const parts = splitTax(tax, t.split);
  const chart = useMemo(() => {
    let v = 40;
    return Array.from({ length: 48 }, (_, i) => (v = Math.max(5, v + Math.sin(i * 1.7 + t.hue) * 6 + (t.change24h > 0 ? 1.2 : -0.6))));
  }, [t]);
  const max = Math.max(...chart);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <TokenAvatar t={t} size={64} />
          <div>
            <h1 className="text-2xl font-bold">{t.name} <span className="font-mono text-base text-muted-foreground">${t.ticker}</span></h1>
            <p className="font-mono text-xs text-muted-foreground">by {t.creator} · {ago(t.createdMinsAgo)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Price", `${t.price.toFixed(7)} QMS`], ["Market cap", `${fmt(t.marketCap)} QMS`], ["24h volume", `${fmt(t.volume24h)} QMS`], ["Holders", String(t.holders)]].map(([l, v]) => (
            <div key={l} className="glass rounded-xl p-3"><p className="text-[11px] uppercase text-muted-foreground">{l}</p><p className="font-mono text-sm font-bold">{v}</p></div>
          ))}
        </div>
        <div className="glass rounded-xl p-4">
          <div className="mb-2 flex justify-between text-sm"><span className="font-semibold">Price</span><Change v={t.change24h} /></div>
          <div className="flex h-48 items-end gap-0.5">
            {chart.map((v, i) => <div key={i} className="flex-1 rounded-t bg-gradient-primary opacity-80" style={{ height: `${(v / max) * 100}%` }} />)}
          </div>
        </div>
        <div className="glass rounded-xl p-4"><Progress t={t} /></div>
        <div className="glass rounded-xl p-4">
          <h2 className="mb-3 text-sm font-bold">Tax & revenue split</h2>
          <p className="mb-3 text-sm text-muted-foreground">Buy tax {t.buyTaxBps / 100}% · Sell tax {t.sellTaxBps / 100}%. Quantapad keeps 10% of tax; the rest is split:</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(t.split).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted p-2 text-center"><p className="text-[11px] capitalize text-muted-foreground">{k}</p><p className="font-mono font-bold">{v}%</p></div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Liquidity is permanently locked.</p>
        </div>
      </div>

      <aside className="glass h-fit rounded-2xl p-5 lg:sticky lg:top-24">
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-full border p-1">
          {(["buy", "sell"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)} className={`rounded-full py-1.5 text-sm font-bold capitalize ${side === s ? (s === "buy" ? "bg-success text-primary-foreground" : "bg-destructive text-destructive-foreground") : "text-muted-foreground"}`}>{s}</button>
          ))}
        </div>
        <label className="text-xs text-muted-foreground">Amount ({side === "buy" ? "QMS" : t.ticker})</label>
        <input className="field mt-1 font-mono" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} />
        <div className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
          <Row l={`Tax (${taxBps / 100}%)`} v={tax.toFixed(4)} />
          <Row l="→ Protocol" v={parts.protocol.toFixed(4)} />
          <Row l="→ Creator / burn / div / LP" v={`${parts.creator.toFixed(3)} / ${parts.burn.toFixed(3)} / ${parts.dividends.toFixed(3)} / ${parts.liquidity.toFixed(3)}`} />
          <Row l="You receive ≈" v={side === "buy" ? `${fmt((n - tax) / t.price)} ${t.ticker}` : `${((n - tax) * t.price).toFixed(6)} QMS`} />
        </div>
        <button className="btn-primary mt-5 w-full py-3" onClick={address ? () => alert("This is a sample token. Trade real tokens from the Live on QMS Testnet list on Explore.") : connect}>
          {address ? `${side === "buy" ? "Buy" : "Sell"} ${t.ticker}` : "Connect wallet"}
        </button>
      </aside>
    </div>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return <div className="flex justify-between gap-2"><span>{l}</span><span className="text-right text-foreground">{v}</span></div>;
}
