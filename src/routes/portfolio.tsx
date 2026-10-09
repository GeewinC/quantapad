import { createFileRoute, Link } from "@tanstack/react-router";
import { TOKENS, fmt } from "@/lib/tokens";
import { TokenAvatar, Change } from "@/components/shell";
import { useWallet, QMS_TESTNET } from "@/lib/wallet";

export const Route = createFileRoute("/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio & claims — Quantapad" },
      { name: "description", content: "See your Quantapad holdings and claim creator fees and dividends." },
      { property: "og:title", content: "Your Quantapad portfolio" },
      { property: "og:description", content: "Holdings, creator fees and dividend claims on QMS." },
    ],
  }),
  component: Portfolio,
});

const HOLDINGS = [
  { t: TOKENS[0]!, bal: 1_240_000, claim: 0.84 },
  { t: TOKENS[2]!, bal: 3_500_000, claim: 0.21 },
  { t: TOKENS[4]!, bal: 820_000, claim: 0.07 },
];

function Portfolio() {
  const { address, connect } = useWallet();
  if (!address)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Your portfolio</h1>
        <p className="mt-2 text-muted-foreground">Connect your wallet to see holdings and claimable rewards.</p>
        <button className="btn-primary mt-6" onClick={connect}>Connect wallet</button>
        <p className="mt-4 text-xs text-muted-foreground">Need test QMS? <a className="text-primary underline" href={QMS_TESTNET.faucet} target="_blank" rel="noreferrer">Get some from the faucet</a></p>
      </div>
    );
  const total = HOLDINGS.reduce((a, h) => a + h.claim, 0);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="glass mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 shadow-glow">
        <div><p className="text-xs uppercase text-muted-foreground">Claimable rewards</p><p className="font-mono text-3xl font-bold text-gradient">{total.toFixed(3)} QMS</p></div>
        <button className="btn-primary" onClick={() => alert("Claims go live once contracts are deployed.")}>Claim all</button>
      </div>
      <div className="space-y-3">
        {HOLDINGS.map(({ t, bal, claim }) => (
          <div key={t.id} className="glass flex flex-wrap items-center gap-4 rounded-xl p-4">
            <TokenAvatar t={t} />
            <Link to="/token/$id" params={{ id: t.id }} className="min-w-0 flex-1">
              <p className="font-bold">{t.name}</p>
              <p className="font-mono text-xs text-muted-foreground">{fmt(bal)} ${t.ticker} · ≈ {(bal * t.price).toFixed(2)} QMS <Change v={t.change24h} /></p>
            </Link>
            <div className="text-right font-mono text-sm"><p className="text-[10px] uppercase text-muted-foreground">Dividends</p>{claim.toFixed(3)} QMS</div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">Sample holdings shown until contracts are live.</p>
    </div>
  );
}
