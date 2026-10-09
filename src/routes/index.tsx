import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { TOKENS, kingOfTheHill, fmt, ago } from "@/lib/tokens";
import { TokenAvatar, Progress, Change } from "@/components/shell";
import { useQuery } from "@tanstack/react-query";
import { loadAll } from "@/lib/chain";
import { LiveAvatar } from "@/components/live-avatar";
import { short } from "@/lib/wallet";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Quantapad — Launch tokens on QMS in one transaction" },
      { name: "description", content: "Explore new tokens, follow King of the Hill, and launch your own token with custom taxes on QMS Testnet." },
      { property: "og:title", content: "Quantapad — Token launchpad on QMS" },
      { property: "og:description", content: "One-transaction token launches with configurable taxes and 4-way revenue splits." },
    ],
  }),
  component: Home,
});

const SORTS = { trending: "Trending", new: "Newest", mcap: "Market cap" } as const;

function Home() {
  const king = kingOfTheHill();
  const [sort, setSort] = useState<keyof typeof SORTS>("trending");
  const [q, setQ] = useState("");
  const list = TOKENS.filter((t) => `${t.name} ${t.ticker}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) =>
    sort === "new" ? a.createdMinsAgo - b.createdMinsAgo : sort === "mcap" ? b.marketCap - a.marketCap : b.change24h - a.change24h,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10 text-center">
        <h1 className="text-3xl font-bold md:text-5xl">Launch in <span className="text-gradient">one transaction</span></h1>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Custom buy and sell taxes, a 4-way revenue split, and liquidity locked forever. On QMS.</p>
        <Link to="/create" className="btn-primary mt-6 px-6 py-3 text-base">Create a token</Link>
      </section>

      <Link to="/token/$id" params={{ id: king.id }} className="glass mb-10 block rounded-2xl p-5 shadow-glow transition hover:-translate-y-0.5">
        <p className="mb-3 font-display text-xs font-bold uppercase tracking-widest text-gold">👑 King of the Hill</p>
        <div className="flex flex-wrap items-center gap-4">
          <TokenAvatar t={king} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold">{king.name} <span className="font-mono text-sm text-muted-foreground">${king.ticker}</span></h2>
            <p className="text-sm text-muted-foreground">{king.description}</p>
            <div className="mt-3 max-w-md"><Progress t={king} /></div>
          </div>
          <div className="grid grid-cols-3 gap-6 font-mono text-sm">
            <Stat l="Volume" v={`${fmt(king.volume24h)}`} />
            <Stat l="Holders" v={String(king.holders)} />
            <Stat l="Tax" v={`${king.buyTaxBps / 100}/${king.sellTaxBps / 100}%`} />
          </div>
        </div>
      </Link>

      <LiveTokens />

      <h2 className="mb-3 text-lg font-bold">Sample tokens</h2>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="field max-w-xs" placeholder="Search name or ticker" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1 rounded-full border p-1">
          {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => (
            <button key={k} onClick={() => setSort(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ${sort === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{SORTS[k]}</button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <Link key={t.id} to="/token/$id" params={{ id: t.id }} className="glass rounded-xl p-4 transition hover:border-primary/60">
            <div className="flex gap-3">
              <TokenAvatar t={t} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-bold">{t.name}</h3>
                  <Change v={t.change24h} />
                </div>
                <p className="font-mono text-xs text-muted-foreground">${t.ticker} · {ago(t.createdMinsAgo)} · by {t.creator}</p>
              </div>
            </div>
            <div className="mt-4"><Progress t={t} /></div>
          </Link>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">Sample tokens are for preview only and cannot be traded.</p>
    </div>
  );
}

function Stat({ l, v }: { l: string; v: string }) {
  return <div><p className="text-[10px] uppercase text-muted-foreground">{l}</p><p className="font-bold">{v}</p></div>;
}

function LiveTokens() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["live-all"], queryFn: loadAll, refetchInterval: 20000 });
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-bold">Live on QMS Testnet</h2>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading from chain…</p> : isError ? <p className="text-sm text-destructive">Couldn't reach QMS Testnet.</p> : !data?.length ? <p className="text-sm text-muted-foreground">No tokens launched yet. <Link to="/create" className="text-primary underline">Be the first</Link>.</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t) => (
            <Link key={t.address} to="/token/$id" params={{ id: t.address }} className="glass rounded-xl p-4 transition hover:border-primary/60">
              <div className="flex gap-3">
                <LiveAvatar t={t} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold">{t.name}</h3>
                  <p className="font-mono text-xs text-muted-foreground">${t.symbol} · by {short(t.creator)}</p>
                  <p className="font-mono text-xs">MC {fmt(t.marketCap)} QMS</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
