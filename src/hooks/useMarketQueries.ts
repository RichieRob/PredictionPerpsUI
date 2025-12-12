// src/hooks/Markets/useMarketQueries.ts
'use client';

import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../config/contracts';

const ZERO = '0x0000000000000000000000000000000000000000' as const;

export function useMarketQueries(id: bigint) {
  const { ledger, ledgerViews } = CONTRACTS.sepolia;
  const { address } = useAccount();

  // Market meta (name, ticker, positionsLocked)
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
    functionName: positionsFunctionName as any,
    args: positionsArgs as any,
  });

  const positionsLen = Array.isArray(positionsQuery.data)
    ? (positionsQuery.data as any[]).length
    : 0;

  // ✅ pricing MM per market
  const pricingMMQuery = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getPricingMM',
    args: [id],
  });

  const pricingMM = pricingMMQuery.data as `0x${string}` | undefined;

  const hasPositions = positionsLen > 0;
  const hasPricingMM = !!pricingMM && pricingMM !== ZERO;

  // ✅ Back prices + reserve from pricingMM (IMarketMaker format)
  const pricesQuery = useReadContract({
    address: (pricingMM ?? ZERO) as `0x${string}`,
    abi: ABIS.marketMaker,
    functionName: 'getAllBackPricesWad',
    args: [id],
    query: {
      enabled: hasPositions && hasPricingMM,
    },
  });

  // ✅ Lay prices from pricingMM (IMarketMaker format)
  const layPricesQuery = useReadContract({
    address: (pricingMM ?? ZERO) as `0x${string}`,
    abi: ABIS.marketMaker,
    functionName: 'getAllLayPricesWad',
    args: [id],
    query: {
      enabled: hasPositions && hasPricingMM,
    },
  });

  // OTHER / reserve exposure (per account)
  const reserveExposureQuery = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getReserveExposure',
    args: address ? [address, id] : undefined,
    query: { enabled: !!address },
  });

  return {
    address,
    marketMetaQuery,
    positionsQuery,

    pricingMM,
    pricingMMQuery,

    pricesQuery,
    layPricesQuery,

    reserveExposureQuery,
  };
}
