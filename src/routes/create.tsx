import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MAX_TAX_BPS } from "@/lib/tokens";
import { TokenAvatar } from "@/components/shell";
import { useWallet } from "@/lib/wallet";
import mark from "@/assets/quantapad-mark.png";
import { launch, errMsg, explorerTx } from "@/lib/chain";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Create a token — Quantapad" },
      { name: "description", content: "Launch an ERC-20 on QMS in one transaction with custom taxes, revenue split, and an optional dev buy." },
      { property: "og:title", content: "Create a token on Quantapad" },
      { property: "og:description", content: "Name, ticker, taxes, split, dev buy — launch in one transaction." },
    ],
  }),
  component: Create,
});

const STEPS = ["Basics", "Links", "Taxes", "Split", "Dev buy", "Review"];
type Split = { creator: number; burn: number; dividends: number; liquidity: number };

function Create() {
  const { address, connect } = useWallet();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: "", ticker: "", emoji: "🚀", description: "", website: "", x: "", telegram: "", buyTax: 200, sellTax: 300, devBuy: "0.5" });
  const [split, setSplit] = useState<Split>({ creator: 40, burn: 20, dividends: 20, liquidity: 20 });
  const [icon, setIcon] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const [done, setDone] = useState<{ hash: string; token?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  async function doLaunch() {
    setBusy(true); setTxError(null);
    try {
      setDone(await launch({ name: f.name.trim(), symbol: f.ticker.trim().toUpperCase(), meta: { emoji: f.emoji, image: icon ?? undefined, description: f.description, website: f.website, x: f.x, telegram: f.telegram }, buyTax: f.buyTax, sellTax: f.sellTax, split, devBuy: f.devBuy }));
    } catch (e) { setTxError(errMsg(e)); } finally { setBusy(false); }
  }
  const total = Object.values(split).reduce((a, b) => a + b, 0);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const onIcon = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setIconError("PNG, JPG, WebP or GIF only.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setIconError("Icon must be under 2 MB.");
      return;
    }
    setIconError(null);
    const reader = new FileReader();
    reader.onload = () => {
      // Shrink to 96px so the icon is cheap to store on-chain
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas"); c.width = c.height = 96;
        const k = Math.max(96 / img.width, 96 / img.height);
        c.getContext("2d")!.drawImage(img, (96 - img.width * k) / 2, (96 - img.height * k) / 2, img.width * k, img.height * k);
        setIcon(c.toDataURL("image/webp", 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };
  const canNext = step === 0 ? f.name.trim() && f.ticker.trim() && !iconError : step === 3 ? total === 100 : true;

  if (done)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <img src={mark} alt="" className="mx-auto h-16 animate-pulse" />
        <h1 className="mt-6 text-2xl font-bold">${f.ticker.toUpperCase()} is live</h1>
        <p className="mt-2 text-muted-foreground">Launched on QMS Testnet. <a className="text-primary underline" href={explorerTx(done.hash)} target="_blank" rel="noreferrer">View transaction</a></p>
        <div className="mt-6 flex justify-center gap-2">
          {done.token && <Link to="/token/$id" params={{ id: done.token }} className="btn-primary">Open token</Link>}
          <button className="btn-ghost" onClick={() => { setDone(null); setStep(0); }}>Create another</button>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Create a token</h1>
      <ol className="mb-6 flex gap-1">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={`h-1 rounded-full ${i <= step ? "bg-gradient-primary" : "bg-muted"}`} />
            <p className={`mt-1 hidden text-[11px] sm:block ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</p>
          </li>
        ))}
      </ol>

      <div className="glass space-y-4 rounded-2xl p-5">
        {step === 0 && (<>
          <F l="Name"><input className="field" value={f.name} onChange={set("name")} placeholder="Quantum Cat" maxLength={32} /></F>
          <F l="Ticker"><input className="field font-mono uppercase" value={f.ticker} onChange={set("ticker")} placeholder="QCAT" maxLength={10} /></F>
          <F l="Icon">
            <div className="flex items-center gap-3">
              {icon ? (
                <img src={icon} alt="Token icon preview" className="h-16 w-16 rounded-2xl border border-border object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-dashed border-border text-2xl">{f.emoji}</div>
              )}
              <div className="space-y-1">
                <label className="btn-ghost inline-block cursor-pointer text-sm">
                  Upload image
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onIcon} />
                </label>
                <p className="text-xs text-muted-foreground">PNG, JPG, WebP or GIF · max 2 MB · square works best</p>
                {iconError && <p className="text-xs text-destructive">{iconError}</p>}
                {icon && <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setIcon(null)}>Remove</button>}
              </div>
            </div>
          </F>
          <F l="Fallback emoji"><input className="field w-24 text-2xl" value={f.emoji} onChange={set("emoji")} maxLength={4} /></F>
          <F l="Description"><textarea className="field" rows={3} value={f.description} onChange={set("description")} /></F>
          <p className="text-xs text-muted-foreground">Supply: 1,000,000,000 · 18 decimals</p>
        </>)}
        {step === 1 && (<>
          <F l="Website"><input className="field" value={f.website} onChange={set("website")} placeholder="https://" /></F>
          <F l="X / Twitter"><input className="field" value={f.x} onChange={set("x")} placeholder="@handle" /></F>
          <F l="Telegram"><input className="field" value={f.telegram} onChange={set("telegram")} placeholder="t.me/…" /></F>
        </>)}
        {step === 2 && (<>
          <Slider l="Buy tax" v={f.buyTax} max={MAX_TAX_BPS} on={(v) => setF({ ...f, buyTax: v })} />
          <Slider l="Sell tax" v={f.sellTax} max={MAX_TAX_BPS} on={(v) => setF({ ...f, sellTax: v })} />
          <p className="text-xs text-muted-foreground">Max 10%. Quantapad keeps 10% of collected tax.</p>
        </>)}
        {step === 3 && (<>
          {(Object.keys(split) as (keyof Split)[]).map((k) => (
            <Slider key={k} l={k.charAt(0).toUpperCase() + k.slice(1)} v={split[k] * 100} max={10000} step={500} on={(v) => setSplit({ ...split, [k]: v / 100 })} />
          ))}
          <p className={`font-mono text-sm ${total === 100 ? "text-success" : "text-destructive"}`}>Total: {total}% {total !== 100 && "— must equal 100%"}</p>
        </>)}
        {step === 4 && (<>
          <F l="Dev buy (QMS)"><input className="field font-mono" inputMode="decimal" value={f.devBuy} onChange={set("devBuy")} /></F>
          <p className="text-xs text-muted-foreground">Optional. Buys your token in the same transaction as the launch.</p>
        </>)}
        {step === 5 && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3">
              {icon ? (
                <img src={icon} alt="Token icon" className="h-14 w-14 rounded-2xl border border-border object-cover" />
              ) : (
                <TokenAvatar t={{ emoji: f.emoji, hue: 310 }} size={56} />
              )}
              <div><p className="font-bold">{f.name}</p><p className="font-mono text-muted-foreground">${f.ticker.toUpperCase()}</p></div>
            </div>
            <dl className="grid grid-cols-2 gap-2 font-mono text-xs">
              <dt className="text-muted-foreground">Taxes</dt><dd>{f.buyTax / 100}% buy / {f.sellTax / 100}% sell</dd>
              <dt className="text-muted-foreground">Split</dt><dd>{split.creator}/{split.burn}/{split.dividends}/{split.liquidity}</dd>
              <dt className="text-muted-foreground">Dev buy</dt><dd>{f.devBuy || 0} QMS</dd>
              <dt className="text-muted-foreground">Liquidity</dt><dd>Locked forever</dd>
            </dl>
          </div>
        )}
      </div>

      {txError && <p className="mt-4 text-sm text-destructive">{txError}</p>}
      <div className="mt-5 flex justify-between">
        <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        {step < 5 ? (
          <button className="btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</button>
        ) : (
          <button className="btn-primary" disabled={busy} onClick={address ? doLaunch : connect}>
            <img src={mark} alt="" className="h-4" />{busy ? "Launching…" : address ? "Launch token" : "Connect wallet"}
          </button>
        )}
      </div>
    </div>
  );
}

function F({ l, children }: { l: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs text-muted-foreground">{l}</span>{children}</label>;
}
function Slider({ l, v, max, step = 25, on }: { l: string; v: number; max: number; step?: number; on: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm"><span>{l}</span><span className="font-mono text-primary">{(v / 100).toFixed(2).replace(/\.00$/, "")}%</span></span>
      <input type="range" min={0} max={max} step={step} value={v} onChange={(e) => on(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
    </label>
  );
}
