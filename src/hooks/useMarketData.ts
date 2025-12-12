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
  price: number | null; // BACK price
  layPrice: number | null; // LAY price
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

function wadToNumber(wad: bigint): number | null {
  const n = Number(wad) / 1e18;
  return Number.isFinite(n) ? n : null;
}

export function useMarketData(id: bigint) {
  const {
    address,
    marketMetaQuery,
    positionsQuery,
    pricesQuery,
    layPricesQuery,
    reserveExposureQuery,
    pricingMM,
    pricingMMQuery,
  } = useMarketQueries(id);

  // ---- Market meta ----
  const {
    data: marketData,
    refetch: refetchMarketMeta,
    isLoading: isLoadingMarketMeta,
  } = marketMetaQuery;

  const [marketName, marketTicker, positionsLocked] = (marketData || []) as [
    string,
    string,
    boolean
  ];

  // ---- Positions ----
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

  // Collapse Back + Lay into logical positions (1 row per positionId)
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
        if ('balance' in info) entry.backBalance = info.balance ?? 0n;
      } else {
        entry.layToken = info.tokenAddress as `0x${string}`;
        if ('balance' in info) entry.layBalance = info.balance ?? 0n;
      }
    }

    // Only keep entries that actually have a Back token listed (one per slot)
    return Array.from(map.values()).filter((e) => !!e.backToken);
  }, [rawInfos]);

  const positions = useMemo(
    () => logicalPositions.map((p) => p.positionId),
    [logicalPositions]
  );

  const havePositions =
    positionsInfoRaw !== undefined && logicalPositions.length > 0;

  // ---- Prices (IMarketMaker arrays) ----
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

  // pricesRaw shape: [positionIds[], priceWads[], reservePriceWad]
  const [backPosIds, backPriceWads, reservePriceWad] = (pricesRaw ||
    [[], [], 0n]) as [bigint[], bigint[], bigint];

  // layPricesRaw shape: [positionIds[], priceWads[]]
  const [layPosIds, layPriceWads] = (layPricesRaw ||
    [[], []]) as [bigint[], bigint[]];

  const backPriceByPosId = useMemo(() => {
    const map = new Map<bigint, number>();
    for (let i = 0; i < backPosIds.length; i++) {
      const posId = backPosIds[i];
      const wad = backPriceWads[i] ?? 0n;
      const n = wadToNumber(wad);
      if (n != null) map.set(posId, n);
    }
    return map;
  }, [backPosIds, backPriceWads]);

  const layPriceByPosId = useMemo(() => {
    const map = new Map<bigint, number>();
    for (let i = 0; i < layPosIds.length; i++) {
      const posId = layPosIds[i];
      const wad = layPriceWads[i] ?? 0n;
      const n = wadToNumber(wad);
      if (n != null) map.set(posId, n);
    }
    return map;
  }, [layPosIds, layPriceWads]);

  const positionPrices: (number | null)[] = useMemo(
    () => positions.map((posId) => backPriceByPosId.get(posId) ?? null),
    [positions, backPriceByPosId]
  );

  const layPrices: (number | null)[] = useMemo(
    () => positions.map((posId) => layPriceByPosId.get(posId) ?? null),
    [positions, layPriceByPosId]
  );

  const reservePrice = useMemo(() => {
    const n = wadToNumber(reservePriceWad);
    return n == null ? null : n;
  }, [reservePriceWad]);

  // ---- OTHER exposure ----
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

  // ---- Readiness ----
  const havePrices =
    positions.length === 0 || (!!pricesRaw && !!layPricesRaw);
  const fullyReady = havePositions && havePrices && !!positionsInfoRaw;

  // 🔎 Debug (kept, but now with useful decode info)
  if (typeof window !== 'undefined') {
    console.log('[useMarketData]', {
      marketId: id.toString(),
      pricingMM,
      pricingMMErr: pricingMMQuery?.error,
      positionsLen: logicalPositions.length,
      pricesEnabled: pricesQuery.isEnabled,
      pricesStatus: pricesQuery.status,
      pricesErr: pricesQuery.error,
      layPricesEnabled: layPricesQuery.isEnabled,
      layPricesStatus: layPricesQuery.status,
      layPricesErr: layPricesQuery.error,
      backPricesDecoded: backPosIds.length,
      layPricesDecoded: layPosIds.length,
      reservePrice: reservePrice ?? null,
    });
  }

  // ---- Rows ----
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
        balance,
        layBalance,
        price: positionPrices[idx],
        layPrice: layPrices[idx],
      };
    });
  }, [fullyReady, logicalPositions, positionPrices, layPrices]);

  const previousRows = usePrevious(rows) || [];
  const displayRows = fullyReady ? rows : previousRows;

  // ---- Sorting ----
  const { sortedRows, sort, sortKey, sortDir } = useSortedRows(displayRows);

  // ---- Refetch all ----
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
    reserveExposure,
    sort,
    sortKey,
    sortDir,
    refetchAll,
    isLoading,
    positionsLocked,
  };
}
