// src/components/Markets/useMarketData.ts
'use client';

import { useMemo, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../../config/contracts';
import { useSortedRows } from './useSortedRows';
import { usePrevious } from '../../hooks/usePrevious';

export type PositionRow = {
  positionId: bigint;
  name: string;
  ticker: string;
  tokenAddress: `0x${string}`; // we use the Back mirror token for now
  erc20Symbol: string;         // base symbol from LedgerViews
  balance: number;             // balance of the Back mirror (decimals = 6)
  price: number | null;        // 0–1 (Back price)
};

// These TS types mirror the structs returned by LedgerViews
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
  const { ledger, ledgerViews, lmsr } = CONTRACTS.sepolia;
  const { address } = useAccount();

  /* ---------------- Market Meta ---------------- */
  const {
    data: marketData,
    refetch: refetchMarketMeta,
    isLoading: isLoadingMarketMeta,
  } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getMarketDetails',
    args: [id],
  });

  const [marketName, marketTicker] = (marketData || []) as [string, string];

  /* ---------------- Positions Info (via LedgerViews) ---------------- */
  const positionsFunctionName = address
    ? 'getMarketPositionsInfoForAccountExtended'
    : 'getMarketPositionsInfoExtended';

  const positionsArgs = address ? [id, address] : [id];

  const {
    data: positionsInfoRaw,
    refetch: refetchPositionsInfo,
    isLoading: isLoadingPositionsInfo,
    isFetching: isFetchingPositionsInfo,
    error: positionsInfoError,
  } = useReadContract({
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
        numEntries: (positionsInfoRaw as any[]).length,
        sample: (positionsInfoRaw as any[]).slice(0, 4),
      });
    } else {
      console.log('[useMarketData] Positions info data is undefined/null', {
        marketId: id.toString(),
      });
    }
  }, [positionsInfoRaw, id]);

  // Raw array from LedgerViews (Back + Lay entries)
  const rawInfos =
    (positionsInfoRaw as
      | PositionInfoExtended[]
      | PositionInfoWithBalanceExtended[]
      | undefined) || [];

  /**
   * Collapse Back + Lay mirrors into ONE logical row per positionId.
   * - We take the Back mirror as the "primary" token for display.
   * - Balance shown = Back mirror balance (0 if viewer not connected).
   */
  const logicalPositions = useMemo(() => {
    type Logical = {
      positionId: bigint;
      name: string;
      ticker: string;
      erc20Symbol: string;
      backToken?: `0x${string}`;
      backBalance?: bigint;
      // layToken / layBalance can be added later if we want them in the UI
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
        // Lay side – we ignore for display right now,
        // but we could store layToken/layBalance here for future use.
        // e.g. entry.layToken = info.tokenAddress;
        //      entry.layBalance = info.balance ?? 0n;
      }
    }

    return Array.from(map.values()).filter((e) => !!e.backToken);
  }, [rawInfos]);

  const positions = logicalPositions.map((p) => p.positionId);
  const havePositions =
    positionsInfoRaw !== undefined && logicalPositions.length > 0;

  /* ---------------- Prices (Back prices only) ---------------- */
  const {
    data: pricesRaw,
    refetch: refetchMarketPrices,
    isLoading: isLoadingPrices,
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

    return positions.map((posId) => priceMap.get(posId) ?? null);
  }, [allPrices, positions]);

  let reservePrice: number | null = null;
  const reserveN = Number(reservePriceWad) / 1e18;
  if (Number.isFinite(reserveN)) reservePrice = reserveN;

  /* ---------------- All-or-nothing readiness ---------------- */
  const havePrices = positions.length === 0 || !!pricesRaw;
  const fullyReady = havePositions && havePrices && !!positionsInfoRaw;

  /* ---------------- Rows (one per logical position) ---------------- */
  const rows: PositionRow[] = useMemo(() => {
    if (!fullyReady) return [];

    return logicalPositions.map((entry, idx) => {
      const balanceRaw = entry.backBalance ?? 0n;
      const balance = Number(balanceRaw) / 1e6;

      console.log('[useMarketData] Row computed', {
        marketId: id.toString(),
        positionId: entry.positionId.toString(),
        backToken: entry.backToken,
        rawBalance: balanceRaw.toString(),
        balance,
      });

      return {
        positionId: entry.positionId,
        name: entry.name,
        ticker: entry.ticker,
        tokenAddress: entry.backToken as `0x${string}`,
        erc20Symbol: entry.erc20Symbol,
        balance,
        price: positionPrices[idx],
      };
    });
  }, [fullyReady, logicalPositions, positionPrices, id]);

  const previousRows = usePrevious(rows) || [];
  const displayRows = fullyReady ? rows : previousRows;

  /* ---------------- Sorting ---------------- */
  const { sortedRows, sort, sortKey, sortDir } = useSortedRows(displayRows);

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
