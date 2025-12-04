// src/hooks/Markets/useMarketData.ts
'use client';

import { useMemo, useEffect } from 'react';
import {
  useAccount,
  useReadContract,
} from 'wagmi';
import { CONTRACTS, ABIS } from '../../config/contracts';
import { useSortedRows } from './useSortedRows';
import { usePrevious } from '../../hooks/usePrevious';

export type PositionRow = {
  positionId: bigint;
  name: string;
  ticker: string;
  tokenAddress: `0x${string}`;
  erc20Symbol: string;
  balance: number;        // whole tokens, decimals = 6
  price: number | null;   // 0–1
};

type PositionInfoExtended = {
  positionId: bigint;
  name: string;
  ticker: string;
  tokenAddress: `0x${string}`;
  erc20Symbol: string;
};

type PositionInfoWithBalanceExtended = PositionInfoExtended & {
  balance: bigint;
};

export type { SortKey, SortDir } from './useSortedRows';

export function useMarketData(id: bigint) {
  // 🔁 include ledgerViews from config
  const { ledger, ledgerViews, lmsr } = CONTRACTS.sepolia;
  const { address } = useAccount();

  /* ---------------- Market Meta ---------------- */
  const {
    data: marketData,
    refetch: refetchMarketMeta,
    isLoading: isLoadingMarketMeta,
    isFetching: isFetchingMarketMeta,
  } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getMarketDetails',
    args: [id],
  });

  const [marketName, marketTicker] = (marketData || []) as [
    string,
    string
  ];

  /* ---------------- Positions Info (via LedgerViews) ---------------- */
  const positionsFunctionName = address
    ? 'getMarketPositionsInfoForAccountExtended'
    : 'getMarketPositionsInfoExtended';

  const positionsArgs = address
    ? [id, address]
    : [id];

  const {
    data: positionsInfoRaw,
    refetch: refetchPositionsInfo,
    isLoading: isLoadingPositionsInfo,
    isFetching: isFetchingPositionsInfo,
    error: positionsInfoError,
  } = useReadContract({
    // 🔴 POINT AT LedgerViews, NOT ledger
    address: ledgerViews as `0x${string}`,
    abi: ABIS.ledgerViews,
    functionName: positionsFunctionName,
    args: positionsArgs,
    query: {
      enabled: true,
    },
  });

  console.log('[useMarketData] Positions info fetch status', {
    marketId: id.toString(),
    address,
    functionName: positionsFunctionName,
    isLoading: isLoadingPositionsInfo,
    isFetching: isFetchingPositionsInfo,
    error: positionsInfoError?.message,
  });

  useEffect(() => {
    if (positionsInfoRaw) {
      console.log('[useMarketData] Positions info data updated', {
        marketId: id.toString(),
        numPositions: (positionsInfoRaw as any[]).length,
        sample: (positionsInfoRaw as any[]).slice(0, 3),
      });
    } else {
      console.log('[useMarketData] Positions info data is undefined/null', {
        marketId: id.toString(),
      });
    }
  }, [positionsInfoRaw, id]);

  const positionsInfo =
    (positionsInfoRaw as (PositionInfoExtended | PositionInfoWithBalanceExtended)[] | undefined) || [];

  const positions = positionsInfo.map(info => info.positionId);
  const havePositions = positionsInfoRaw !== undefined && positions.length > 0;

  /* ---------------- Prices ---------------- */
  const {
    data: pricesRaw,
    refetch: refetchMarketPrices,
    isLoading: isLoadingPrices,
    isFetching: isFetchingPrices,
  } = useReadContract({
    address: lmsr as `0x${string}`,
    abi: ABIS.lmsr,
    functionName: 'getAllBackPricesWad',
    args: [id],
    query: {
      enabled: positions.length > 0,
    },
  });

  const [allPrices, reservePriceWad] = (pricesRaw || [[], 0n]) as [
    { positionId: bigint; priceWad: bigint }[],
    bigint
  ];

  const positionPrices: (number | null)[] = useMemo(() => {
    if (positions.length === 0) return [];

    const priceMap = new Map<bigint, number>();
    allPrices.forEach(({ positionId, priceWad }) => {
      const n = Number(priceWad) / 1e18;
      if (Number.isFinite(n)) {
        priceMap.set(positionId, n);
      }
    });

    return positions.map(posId => priceMap.get(posId) ?? null);
  }, [allPrices, positions]);

  let reservePrice: number | null = null;
  const reserveN = Number(reservePriceWad) / 1e18;
  if (Number.isFinite(reserveN)) reservePrice = reserveN;

  /* ---------------- All-or-nothing readiness ---------------- */
  const havePrices = positions.length === 0 || !!pricesRaw;
  const havePosMetaAndBalances =
    !!positionsInfoRaw && positionsInfo.length === positions.length;

  const fullyReady = havePositions && havePrices && havePosMetaAndBalances;

  /* ---------------- Rows ---------------- */
  const rows: PositionRow[] = useMemo(() => {
    if (!fullyReady) return [];

    return positionsInfo.map((info, i) => {
      const balanceRaw = address && 'balance' in info ? info.balance : 0n;
      const balance = Number(balanceRaw) / 1e6;

      console.log('[useMarketData] Computed row balance', {
        marketId: id.toString(),
        positionId: info.positionId.toString(),
        rawBalance: balanceRaw.toString(),
        computedBalance: balance,
      });

      return {
        positionId: info.positionId,
        name: info.name,
        ticker: info.ticker,
        tokenAddress: info.tokenAddress,
        erc20Symbol: info.erc20Symbol,
        balance,
        price: positionPrices[i],
      };
    });
  }, [
    fullyReady,
    positionsInfo,
    positionPrices,
    address,
    id,
  ]);

  const previousRows = usePrevious(rows) || [];
  const displayRows = fullyReady ? rows : previousRows;

  /* ---------------- Sorting ---------------- */
  const {
    sortedRows,
    sort,
    sortKey,
    sortDir,
  } = useSortedRows(displayRows);

  /* ---------------- Refetch all ---------------- */
  const refetchAll = async () => {
    await Promise.allSettled([
      refetchMarketMeta?.(),
      refetchPositionsInfo?.(),
      refetchMarketPrices?.(),
    ]);
  };

  const isLoading =
    isLoadingMarketMeta || isLoadingPositionsInfo || isLoadingPrices;

  return {
    marketName,
    marketTicker,
    rows: sortedRows,
    reservePrice,
    sort,
    sortKey,
    sortDir,
    refetchAll,
    isLoading,
  };
}
