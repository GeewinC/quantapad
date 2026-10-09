import { createContext, useContext, useState, type ReactNode } from "react";

export const QMS_TESTNET = {
  chainId: 19480,
  chainIdHex: "0x" + (19480).toString(16),
  name: "QMS Testnet",
  rpc: "https://rpc.testnet.qms.finance",
  explorer: "https://testnet.qmsscan.io",
  faucet: "https://faucet.testnet.qms.finance",
};

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<any> };
const eth = () => (typeof window !== "undefined" ? (window as unknown as { ethereum?: Eth }).ethereum : undefined);

const Ctx = createContext<{ address: string | null; connect: () => Promise<void>; error: string | null }>({
  address: null,
  connect: async () => {},
  error: null,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setError(null);
    const e = eth();
    if (!e) return setError("No wallet found. Install MetaMask or Rabby.");
    try {
      const [acc] = await e.request({ method: "eth_requestAccounts" });
      try {
        await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: QMS_TESTNET.chainIdHex }] });
      } catch {
        await e.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: QMS_TESTNET.chainIdHex,
            chainName: QMS_TESTNET.name,
            nativeCurrency: { name: "QMS", symbol: "QMS", decimals: 18 },
            rpcUrls: [QMS_TESTNET.rpc],
            blockExplorerUrls: [QMS_TESTNET.explorer],
          }],
        });
      }
      setAddress(acc);
    } catch (err) {
      setError((err as Error).message ?? "Connection failed");
    }
  }
  return <Ctx.Provider value={{ address, connect, error }}>{children}</Ctx.Provider>;
}

export const useWallet = () => useContext(Ctx);
export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
