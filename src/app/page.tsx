'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../config/contracts';
import { Balances } from '../components/Balances';
import { DepositPanel } from '../components/DepositPanel';
import { Markets } from '../components/Markets';

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

  // --- Balances ---

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
    watch: true, // 👈 optional
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
    watch: true, // 👈 optional
  });

  const ppBalance =
    ppBalanceRaw !== undefined ? Number(ppBalanceRaw) / 1e6 : 0;
  const usdcBalance =
    usdcBalanceRaw !== undefined ? Number(usdcBalanceRaw) / 1e6 : 0;

  // --- Markets ---

  const { data: marketIdsRaw } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getMarkets',
  });

  const marketIds = (marketIdsRaw as bigint[] | undefined) || [];

  return (
    <div className="container py-4">
      <header className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h4 mb-0">Prediction Perps</h1>
        <ConnectButton />
      </header>

      {address && (
        <>
          <Balances usdcBalance={usdcBalance} ppBalance={ppBalance} />

          <DepositPanel
            onAfterTx={async () => {
              await Promise.all([refetchUsdc(), refetchPp()]);
            }}
          />
        </>
      )}

      <Markets marketIds={marketIds} />
    </div>
  );
}
