// src/components/Markets/useMarketData.ts
'use client';

import { useMemo } from 'react';
import {
  useAccount,
  useReadContract,
  useReadContracts,
} from 'wagmi';
import { CONTRACTS, ABIS } from '../../config/contracts';
import { useSortedRows } from './useSortedRows';

export type PositionRow = {
  positionId: bigint;
  name: string;
  ticker: string;
  balance: number;        // whole tokens, decimals = 6
  price: number | null;   // 0–1
};

export type { SortKey, SortDir } from './useSortedRows';

export function useMarketData(id: bigint) {
  const { ledger, lmsr } = CONTRACTS.sepolia;
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

  /* ---------------- Positions ---------------- */
  const {
    data: positionsRaw,
    refetch: refetchPositions,
    isLoading: isLoadingPositions,
    isFetching: isFetchingPositions,
  } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getMarketPositions',
    args: [id],
  });

  const positions = (positionsRaw as bigint[] | undefined) || [];
  const positionsLoaded = positionsRaw !== undefined;

  /* ---------------- Prices (LMSR) ---------------- */
  const priceContracts = useMemo(() => {
    if (!lmsr || positions.length === 0) return [];

    return [
      // BACK prices per position
      ...positions.map((posId) => ({
        address: lmsr as `0x${string}`,
        abi: ABIS.lmsr,
        functionName: 'getBackPriceWad',
        args: [id, posId],
      })),
      // reserve / OTHER
      {
        address: lmsr as `0x${string}`,
        abi: ABIS.lmsr,
        functionName: 'getReservePriceWad',
        args: [id],
      },
    ];
  }, [positions, lmsr, id]);

  const {
    data: pricesData,
    refetch: refetchMarketPrices,
    isLoading: isLoadingPrices,
    isFetching: isFetchingPrices,
  } = useReadContracts({
    contracts: priceContracts,
    query: {
      enabled: priceContracts.length > 0,
    },
  });

  const positionPrices: (number | null)[] = useMemo(() => {
    if (!pricesData || positions.length === 0) {
      return positions.map(() => null);
    }
    return positions.map((_, idx) => {
      const entry: any = pricesData[idx];
      const wad = entry?.result as bigint | undefined;
      if (!wad) return null;
      const n = Number(wad) / 1e18;
      return Number.isFinite(n) ? n : null;
    });
  }, [pricesData, positions]);

  let reservePrice: number | null = null;
  if (pricesData && pricesData.length > 0 && positions.length > 0) {
    const reserveEntry: any = pricesData[positions.length];
    const reserve = reserveEntry?.result as bigint | undefined;
    if (reserve) {
      const n = Number(reserve) / 1e18;
      if (Number.isFinite(n)) reservePrice = n;
    }
  }

  /* ---------------- Position meta (names / tickers) ---------------- */
  const posMetaContracts = useMemo(
    () =>
      positions.map((posId) => ({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'getPositionDetails',
        args: [id, posId],
      })),
    [positions, ledger, id]
  );

  const {
    data: posMetaData,
    refetch: refetchPosMeta,
    isLoading: isLoadingPosMeta,
    isFetching: isFetchingPosMeta,
  } = useReadContracts({
    contracts: posMetaContracts,
    query: {
      enabled: positions.length > 0,
    },
  });

  /* ---------------- Balances (ledger.balanceOf) ---------------- */
  const balanceContracts = useMemo(() => {
    if (!address || positions.length === 0) return [];
    // function balanceOf(uint marketId, uint positionId, address account)
    return positions.map((posId) => ({
      address: ledger as `0x${string}`,
      abi: ABIS.ledger,
      functionName: 'balanceOf',
      args: [id, posId, address],
    }));
  }, [address, positions, ledger, id]);

  const {
    data: balancesData,
    refetch: refetchBalances,
    isLoading: isLoadingBalances,
    isFetching: isFetchingBalances,
  } = useReadContracts({
    contracts: balanceContracts,
    query: {
      enabled: balanceContracts.length > 0,
    },
  });

  /* ---------------- All-or-nothing readiness ---------------- */

  const havePositions = positionsLoaded;

  const havePrices =
    positions.length === 0 ||
    (priceContracts.length === 0 ||
      (pricesData && pricesData.length === priceContracts.length));

  const havePosMeta =
    positions.length === 0 ||
    (!!posMetaData && posMetaData.length === positions.length);

  const haveBalances =
    balanceContracts.length === 0 ||
    (!!balancesData && balancesData.length === balanceContracts.length);

  const fullyReady =
    havePositions &&
    havePrices &&
    havePosMeta &&
    haveBalances;

  /* ---------------- Rows ---------------- */
  const rows: PositionRow[] = useMemo(() => {
    if (!fullyReady) return [];

    return positions.map((posId, i) => {
      const metaEntry: any = posMetaData?.[i];
      const balEntry: any = balancesData?.[i];

      const posName = metaEntry?.result?.[0] ?? '';
      const posTicker = metaEntry?.result?.[1] ?? '';

      const balRaw = (balEntry?.result as bigint | undefined) ?? 0n;
      // decimals fixed at 6
      const balance = Number(balRaw) / 1e6;

      const price = positionPrices[i];

      return {
        positionId: posId,
        name: posName,
        ticker: posTicker,
        balance,
        price,
      };
    });
  }, [
    fullyReady,
    positions,
    posMetaData,
    balancesData,
    positionPrices,
  ]);

  /* ---------------- Sorting ---------------- */
  const {
    sortedRows,
    sort,
    sortKey,
    sortDir,
  } = useSortedRows(rows);

  /* ---------------- Refetch all (after tx / manual refresh) ---------------- */
  const refetchAll = async () => {
    await Promise.allSettled([
      refetchMarketMeta?.(),
      refetchPositions?.(),
      refetchMarketPrices?.(),
      refetchPosMeta?.(),
      refetchBalances?.(),
    ]);
  };

  /* ---------------- Combined loading flag ---------------- */
  const isLoading =
    !fullyReady ||
    isLoadingMarketMeta ||
    isFetchingMarketMeta ||
    isLoadingPositions ||
    isFetchingPositions ||
    isLoadingPrices ||
    isFetchingPrices ||
    isLoadingPosMeta ||
    isFetchingPosMeta ||
    isLoadingBalances ||
    isFetchingBalances;

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
