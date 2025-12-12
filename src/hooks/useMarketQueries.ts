// src/hooks/Markets/useMarketQueries.ts
'use client';

import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../config/contracts';

export function useMarketQueries(id: bigint) {
  const { ledger, ledgerViews, lmsr } = CONTRACTS.sepolia;
  const { address } = useAccount();

  // Market meta
  const marketMetaQuery = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getMarketDetails',
    args: [id],
  });

  // Positions info (with/without balances per account)
  const positionsFunctionName = address
    ? 'getMarketPositionsInfoForAccountExtended'
    : 'getMarketPositionsInfoExtended';

  const positionsArgs = address ? [id, address] : [id];

  const positionsQuery = useReadContract({
    address: ledgerViews as `0x${string}`,
    abi: ABIS.ledgerViews,
    functionName: positionsFunctionName,
    args: positionsArgs,
    query: {
      enabled: true,
    },
  });

  // Back prices + reserve
  const pricesQuery = useReadContract({
    address: lmsr as `0x${string}`,
    abi: ABIS.lmsr,
    functionName: 'getAllBackPricesWad',
    args: [id],
    query: {
      enabled: !!positionsQuery.data && (positionsQuery.data as any[]).length > 0,
    },
  });

  // Lay prices
  const layPricesQuery = useReadContract({
    address: lmsr as `0x${string}`,
    abi: ABIS.lmsr,
    functionName: 'getAllLayPricesWad',
    args: [id],
    query: {
      enabled: !!positionsQuery.data && (positionsQuery.data as any[]).length > 0,
    },
  });

  // OTHER / reserve exposure (per account)
  const reserveExposureQuery = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getReserveExposure',
    args: address ? [address, id] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    address,
    marketMetaQuery,
    positionsQuery,
    pricesQuery,
    layPricesQuery,
    reserveExposureQuery,
  };
}
