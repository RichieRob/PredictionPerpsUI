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
  tokenAddress: `0x${string}`; // Back mirror token
  erc20Symbol: string;         // base symbol from LedgerViews
  balance: number;             // Back balance (decimals = 6)
  price: number | null;        // 0–1 (Back price)
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

  const rawInfos =
    (positionsInfoRaw as
      | PositionInfoExtended[]
      | PositionInfoWithBalanceExtended[]
      | undefined) || [];

  /* ---------------- Collapse Back + Lay into logical positions ---------------- */
  const logicalPositions = useMemo(() => {
    type Logical = {
      positionId: bigint;
      name: string;
      ticker: string;
      erc20Symbol: string;
      backToken?: `0x${string}`;
      backBalance?: bigint;
      // layToken / layBalance can be stored later if needed
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
        // Lay side – ignore for now, but could be stored here
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

  /* ---------------- OTHER exposure (getReserveExposure) ---------------- */
  const {
    data: reserveExposureRaw,
    refetch: refetchReserveExposure,
    isLoading: isLoadingReserveExposure,
  } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getReserveExposure',
    // Only call if we have an account
    args: address ? [address, id] : undefined,
    query: {
      enabled: !!address,
    },
  });

  useEffect(() => {
    if (!address) {
      console.log(
        '[useMarketData] getReserveExposure skipped: no account',
        { marketId: id.toString() }
      );
      return;
    }

    console.log(
      '[useMarketData] getReserveExposure returned:',
      reserveExposureRaw,
      'for marketId =',
      id.toString(),
      'account =',
      address
    );
  }, [reserveExposureRaw, address, id]);

  const otherExposureRaw = reserveExposureRaw as bigint | undefined;

  const otherExposure = useMemo(() => {
    if (!otherExposureRaw) return 0;
    const n = Number(otherExposureRaw) / 1e6; // 6 decimals
    return Number.isFinite(n) ? n : 0;
  }, [otherExposureRaw]);

  const previousOtherExposure = usePrevious(otherExposure) ?? 0;
  const reserveExposure = otherExposureRaw !== undefined
    ? otherExposure
    : previousOtherExposure;

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
      // include reserve exposure in the "transaction refresh"
      address ? refetchReserveExposure?.() : undefined,
    ]);
  };

  const isLoading =
    isLoadingMarketMeta ||
    isLoadingPositionsInfo ||
    isLoadingPrices ||
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
