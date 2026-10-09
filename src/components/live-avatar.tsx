import { TokenAvatar } from "@/components/shell";
import type { LiveToken } from "@/lib/chain";

export function LiveAvatar({ t, size = 48 }: { t: LiveToken; size?: number }) {
  if (t.meta.image) return <img src={t.meta.image} alt={t.name} width={size} height={size} className="shrink-0 rounded-xl object-cover" style={{ width: size, height: size }} />;
  return <TokenAvatar t={{ emoji: t.meta.emoji ?? "🚀", hue: t.hue }} size={size} />;
}
