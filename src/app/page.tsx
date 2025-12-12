// src/app/page.tsx
'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../config/contracts';
import { DevInfo } from '../components/DevInfo';
import { Markets } from '../components/Markets/Markets';
import { WalletPanel } from '../components/WalletPanel';
import { MockUsdcPanel } from '../components/MockUsdcPanel';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export default function HomePage() {
  const { address } = useAccount();
  const chainKey = 'sepolia' as const;
  const { ledger, ppUSDC, usdc } = CONTRACTS[chainKey];

  // --- Wallet balances (Mock USDC + ppUSDC) ---

  const {
    data: ppBalanceRaw,
    refetch: refetchPp,
  } = useReadContract({
    address: ppUSDC as `0x${string}`,
    abi: ABIS.ppUSDC,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const {
    data: usdcBalanceRaw,
    refetch: refetchUsdc,
  } = useReadContract({
    address: usdc as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const ppBalance =
    ppBalanceRaw !== undefined ? Number(ppBalanceRaw) / 1e6 : 0;
  const usdcBalance =
    usdcBalanceRaw !== undefined ? Number(usdcBalanceRaw) / 1e6 : 0;

  // --- Market list ---

  const {
    data: marketIdsRaw,
    refetch: refetchMarkets,
    isLoading: isLoadingMarkets,
    isFetching: isFetchingMarkets,
  } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getMarkets',
  });

  const marketIds = (marketIdsRaw as bigint[] | undefined) || [];
  const marketsLoading = isLoadingMarkets;  // Remove isFetching to avoid hiding during refetch

  // --- Global after-tx handler for ALL tx paths ---

  const handleAfterTx = async () => {
    await Promise.allSettled([
      refetchUsdc(),
      refetchPp(),
      refetchMarkets(),
      // future: dev views, estimates, etc.
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