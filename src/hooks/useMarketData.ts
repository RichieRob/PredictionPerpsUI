// src/hooks/Markets/useMarketData.ts
'use client';

import { useMemo } from 'react';
import { usePrevious } from './usePrevious';
import { useSortedRows } from './useSortedRows';
import { useMarketQueries } from './useMarketQueries';

export type PositionRow = {
  positionId: bigint;
  name: string;
  ticker: string;
  tokenAddress: `0x${string}`;
  erc20Symbol: string;
  balance: number;      // BACK exposure
  layBalance: number;   // LAY exposure
  price: number | null;
  layPrice: number | null;
};

// Struct types mirroring LedgerViews
type PositionInfoExtended = {
  positionId: bigint;
  isBack: boolean;
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
  const {
    address,
    marketMetaQuery,
    positionsQuery,
    pricesQuery,
    layPricesQuery,
    reserveExposureQuery,
  } = useMarketQueries(id);

  const {
    data: marketData,
    refetch: refetchMarketMeta,
    isLoading: isLoadingMarketMeta,
  } = marketMetaQuery;

  const [marketName, marketTicker] = (marketData || []) as [string, string];

  const {
    data: positionsInfoRaw,
    refetch: refetchPositionsInfo,
    isLoading: isLoadingPositionsInfo,
  } = positionsQuery;

  const rawInfos =
    (positionsInfoRaw as
      | PositionInfoExtended[]
      | PositionInfoWithBalanceExtended[]
      | undefined) || [];

  // Collapse Back + Lay into logical positions
  const logicalPositions = useMemo(() => {
    type Logical = {
      positionId: bigint;
      name: string;
      ticker: string;
      erc20Symbol: string;
      backToken?: `0x${string}`;
      backBalance?: bigint;
      layToken?: `0x${string}`;
      layBalance?: bigint;
    };

    const map = new Map<bigint, Logical>();

    for (const anyInfo of rawInfos as any[]) {
      const info = anyInfo as PositionInfoExtended & { balance?: bigint };

      let entry = map.get(info.positionId);
      if (!entry) {
        entry = {
          positionId: info.positionId,
          name: info.name,
          ticker: info.ticker,
          erc20Symbol: info.erc20Symbol,
        };
        map.set(info.positionId, entry);
      }

      if (info.isBack) {
        entry.backToken = info.tokenAddress as `0x${string}`;
        if ('balance' in info) {
          entry.backBalance = info.balance ?? 0n;
        }
      } else {
        entry.layToken = info.tokenAddress as `0x${string}`;
        if ('balance' in info) {
          entry.layBalance = info.balance ?? 0n;
        }
      }
    }

    // Only keep entries that actually have a Back token listed
    return Array.from(map.values()).filter((e) => !!e.backToken);
  }, [rawInfos]);

  const positions = logicalPositions.map((p) => p.positionId);
  const havePositions =
    positionsInfoRaw !== undefined && logicalPositions.length > 0;

  // Prices (Back + Lay)
  const {
    data: pricesRaw,
    refetch: refetchMarketPrices,
    isLoading: isLoadingPrices,
  } = pricesQuery;

  const {
    data: layPricesRaw,
    refetch: refetchLayPrices,
    isLoading: isLoadingLayPrices,
  } = layPricesQuery;

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

    return positions.map((posId) => priceMap.get(posId) ?? null);
  }, [allPrices, positions]);

  const layPriceByPosId: Map<bigint, number> = useMemo(() => {
    const map = new Map<bigint, number>();
    if (!layPricesRaw) return map;

    (layPricesRaw as { positionId: bigint; priceWad: bigint }[]).forEach(
      ({ positionId, priceWad }) => {
        const n = Number(priceWad) / 1e18;
        if (Number.isFinite(n)) {
          map.set(positionId, n);
        }
      }
    );
    return map;
  }, [layPricesRaw]);

  const layPrices: (number | null)[] = useMemo(
    () => positions.map((posId) => layPriceByPosId.get(posId) ?? null),
    [positions, layPriceByPosId]
  );

  let reservePrice: number | null = null;
  const reserveN = Number(reservePriceWad) / 1e18;
  if (Number.isFinite(reserveN)) reservePrice = reserveN;

  // OTHER exposure
  const {
    data: reserveExposureRaw,
    refetch: refetchReserveExposure,
    isLoading: isLoadingReserveExposure,
  } = reserveExposureQuery;

  const otherExposureRaw = reserveExposureRaw as bigint | undefined;

  const otherExposure = useMemo(() => {
    if (!otherExposureRaw) return 0;
    const n = Number(otherExposureRaw) / 1e6; // 6 decimals
    return Number.isFinite(n) ? n : 0;
  }, [otherExposureRaw]);

  const previousOtherExposure = usePrevious(otherExposure) ?? 0;
  const reserveExposure =
    otherExposureRaw !== undefined ? otherExposure : previousOtherExposure;

  // All-or-nothing readiness
  const havePrices =
    positions.length === 0 || (!!pricesRaw && !!layPricesRaw);
  const fullyReady = havePositions && havePrices && !!positionsInfoRaw;

  // Rows (one per logical position)
  const rows: PositionRow[] = useMemo(() => {
    if (!fullyReady) return [];

    return logicalPositions.map((entry, idx) => {
      const balanceRaw = entry.backBalance ?? 0n;
      const layBalanceRaw = entry.layBalance ?? 0n;

      const balance = Number(balanceRaw) / 1e6;
      const layBalance = Number(layBalanceRaw) / 1e6;

      return {
        positionId: entry.positionId,
        name: entry.name,
        ticker: entry.ticker,
        tokenAddress: entry.backToken as `0x${string}`,
        erc20Symbol: entry.erc20Symbol,
        balance,           // Back
        layBalance,        // Lay
        price: positionPrices[idx],
        layPrice: layPrices[idx],
      };
    });
  }, [fullyReady, logicalPositions, positionPrices, layPrices]);

  const previousRows = usePrevious(rows) || [];
  const displayRows = fullyReady ? rows : previousRows;

  // Sorting
  const { sortedRows, sort, sortKey, sortDir } = useSortedRows(displayRows);

  // Refetch all
  const refetchAll = async () => {
    await Promise.allSettled([
      refetchMarketMeta?.(),
      refetchPositionsInfo?.(),
      refetchMarketPrices?.(),
      refetchLayPrices?.(),
      address ? refetchReserveExposure?.() : undefined,
    ]);
  };

  const isLoading =
    isLoadingMarketMeta ||
    isLoadingPositionsInfo ||
    isLoadingPrices ||
    isLoadingLayPrices ||
    isLoadingReserveExposure;

  return {
    marketName,
    marketTicker,
    rows: sortedRows,
    reservePrice,
    reserveExposure, // OTHER balance, 6dp → number
    sort,
    sortKey,
    sortDir,
    refetchAll,
    isLoading,
  };
}
