// src/app/page.tsx
'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { DevInfo } from '../components/DevInfo';
import { Markets } from '../components/Markets/Markets';
import { WalletPanel } from '../components/WalletPanel';
import { MockUsdcPanel } from '../components/MockUsdcPanel';

import { useWalletBalances } from '../hooks/useWalletBalances';
import { useMarketsList } from '../hooks/useMarketsList';

export default function HomePage() {
  // Wallet (balances + refetch)
  const {
    address,
    ppBalance,
    usdcBalance,
    refetchPp,
    refetchUsdc,
  } = useWalletBalances();

  // Market list + contract addresses
  const {
    ledger,
    ppUSDC,
    usdc,
    marketIds,
    refetchMarkets,
    marketsLoading,
  } = useMarketsList();

  // Global after-tx refresh
  const handleAfterTx = async () => {
    await Promise.allSettled([
      refetchUsdc?.(),
      refetchPp?.(),
      refetchMarkets?.(),
    ]);
  };

  return (
    <div className="container py-4">
      <header className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h4 mb-0">Prediction Perps</h1>
        <ConnectButton />
      </header>

      {address && (
        <>
          <MockUsdcPanel onAfterMint={refetchUsdc} />

          <WalletPanel
            usdcBalance={usdcBalance}
            ppBalance={ppBalance}
            onAfterTx={handleAfterTx}
          />
        </>
      )}

      {marketsLoading ? (
        <div className="mt-4 text-center">
          <span
            className="spinner-border text-secondary"
            role="status"
            aria-hidden="true"
          />
          <div className="text-muted mt-2">Loading markets…</div>
        </div>
      ) : (
        <Markets marketIds={marketIds} onAfterTx={handleAfterTx} />
      )}

      <DevInfo ledger={ledger} ppUSDC={ppUSDC} usdc={usdc} />
    </div>
  );
}
