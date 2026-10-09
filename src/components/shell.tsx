import { Link } from "@tanstack/react-router";
import mark from "@/assets/quantapad-mark.png";
import { useWallet, short, QMS_TESTNET } from "@/lib/wallet";
import { milestonePct, type Token, fmt } from "@/lib/tokens";

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <img src={mark} alt="Quantapad" style={{ height: size }} className="w-auto" />
      <span className="font-display text-lg tracking-wide text-primary">
        <span className="font-bold">QUANTA</span><span className="font-light">PAD</span>
      </span>
    </Link>
  );
}

export function Header() {
  const { address, connect, error } = useWallet();
  const nav = "text-sm text-muted-foreground hover:text-foreground transition-colors";
  return (
    <header className="sticky top-0 z-30 glass border-x-0 border-t-0">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/" className={nav} activeProps={{ className: "text-foreground" }} activeOptions={{ exact: true }}>Explore</Link>
          <Link to="/create" className={nav} activeProps={{ className: "text-foreground" }}>Create</Link>
          <Link to="/portfolio" className={nav} activeProps={{ className: "text-foreground" }}>Portfolio</Link>
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground sm:inline">
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" />{QMS_TESTNET.name}
          </span>
          <button onClick={connect} title={error ?? undefined} className="btn-primary">
            {address ? short(address) : "Connect"}
          </button>
        </div>
      </div>
      <nav className="flex justify-around border-t py-2 md:hidden">
        <Link to="/" className={nav} activeOptions={{ exact: true }} activeProps={{ className: "text-primary" }}>Explore</Link>
        <Link to="/create" className={nav} activeProps={{ className: "text-primary" }}>Create</Link>
        <Link to="/portfolio" className={nav} activeProps={{ className: "text-primary" }}>Portfolio</Link>
      </nav>
      {error && <p className="bg-destructive/20 px-4 py-1 text-center text-xs text-destructive">{error}</p>}
    </header>
  );
}

export function TokenAvatar({ t, size = 48 }: { t: Pick<Token, "emoji" | "hue">; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center rounded-xl"
      style={{ width: size, height: size, fontSize: size * 0.5, background: `linear-gradient(135deg, oklch(0.5 0.15 ${t.hue}), oklch(0.28 0.1 ${t.hue + 30}))` }}
    >
      {t.emoji}
    </div>
  );
}

export function Progress({ t }: { t: Token }) {
  const p = milestonePct(t);
  return (
    <div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-gradient-primary" style={{ width: `${p}%` }} />
      </div>
      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{p.toFixed(0)}% to milestone · MC {fmt(t.marketCap)} QMS</p>
    </div>
  );
}

export function Change({ v }: { v: number }) {
  return <span className={`font-mono text-xs ${v >= 0 ? "text-success" : "text-destructive"}`}>{v >= 0 ? "+" : ""}{v.toFixed(1)}%</span>;
}
