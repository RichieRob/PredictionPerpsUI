// src/hooks/useMarketsList.ts
'use client';

import { useReadContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../config/contracts';

export function useMarketsList() {
  const chainKey = 'sepolia' as const;
  const { ledger, ppUSDC, usdc } = CONTRACTS[chainKey];

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
  const marketsLoading = isLoadingMarkets; // keep isFetchingMarkets if you want later

  return {
    ledger,
    ppUSDC,
    usdc,
    marketIds,
    refetchMarkets,
    marketsLoading,
    isFetchingMarkets,
  };
}
