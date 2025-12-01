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

// Minimal ERC20 ABI: balanceOf + symbol + decimals
const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

export type PositionRow = {
  positionId: bigint;
  name: string;
  ticker: string;
  tokenAddress: `0x${string}` | null;
  balance: number;
  price: number | null;
  erc20Symbol: string | null;
  erc20Decimals: number | null;
};

export type { SortKey, SortDir } from './useSortedRows';

export function useMarketData(id: bigint) {
  const { ledger, lmsr } = CONTRACTS.sepolia;
  const { address } = useAccount();

  /* ---------------- Market Meta ---------------- */
  const {
    data: marketData,
    refetch: refetchMarketMeta,
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
  } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getMarketPositions',
    args: [id],
  });

  const positions = (positionsRaw as bigint[] | undefined) || [];

  /* ---------------- Prices ---------------- */
  const priceContracts = useMemo(() => {
    if (!lmsr || positions.length === 0) return [];

    return [
      // position prices
      ...positions.map((posId) => ({
        address: lmsr as `0x${string}`,
        abi: ABIS.lmsr,
        functionName: 'getBackPriceWad',
        args: [id, posId],
      })),
      // reserve / OTHER price
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
  } = useReadContracts({
    contracts: priceContracts,
    query: {
      enabled: priceContracts.length > 0,
      refetchInterval: 5000,
    },
  });

  const positionPrices: (number | null)[] = useMemo(() => {
    if (!pricesData) return positions.map(() => null);

    return positions.map((_, idx) => {
      const entry: any = pricesData[idx];
      const wad = entry?.result as bigint | undefined;
      if (!wad) return null;
      const n = Number(wad) / 1e18;
      return Number.isFinite(n) ? n : null;
    });
  }, [pricesData, positions]);

  /* ---------------- Reserve (OTHER) ---------------- */
  let reservePrice: number | null = null;
  if (pricesData && pricesData.length > 0) {
    const reserveEntry: any = pricesData[positions.length];
    const reserve = reserveEntry?.result as bigint | undefined;
    if (reserve) {
      const n = Number(reserve) / 1e18;
      if (Number.isFinite(n)) reservePrice = n;
    }
  }

  /* ---------------- Position meta ---------------- */
  const posMetaContracts = useMemo(() => {
    return positions.map((posId) => ({
      address: ledger as `0x${string}`,
      abi: ABIS.ledger,
      functionName: 'getPositionDetails',
      args: [id, posId],
    }));
  }, [positions, ledger, id]);

  const {
    data: posMetaData,
    refetch: refetchPosMeta,
  } = useReadContracts({
    contracts: posMetaContracts,
    query: { enabled: positions.length > 0 },
  });

  /* ---------------- ERC20 token addrs ---------------- */
  const posTokenContracts = useMemo(() => {
    return positions.map((posId) => ({
      address: ledger as `0x${string}`,
      abi: ABIS.ledger,
      functionName: 'getPositionERC20',
      args: [id, posId],
    }));
  }, [positions, ledger, id]);

  const {
    data: posTokenData,
    refetch: refetchPosTokens,
  } = useReadContracts({
    contracts: posTokenContracts,
    query: { enabled: positions.length > 0 },
  });

  /* ---------------- balances ---------------- */
  const balanceContracts = useMemo(() => {
    if (!address || !posTokenData) return [];
    return positions.map((_, i) => {
      const tokenAddr = posTokenData[i]?.result as `0x${string}` | undefined;
      if (!tokenAddr) return null;
      return {
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      };
    }).filter(Boolean) as any[];
  }, [address, posTokenData, positions]);

  const {
    data: balancesData,
    refetch: refetchBalances,
  } = useReadContracts({
    contracts: balanceContracts,
    query: {
      enabled: balanceContracts.length > 0,
      watch: true,
    },
  });

  /* ---------------- ERC20 symbol ---------------- */
  const symbolContracts = useMemo(() => {
    if (!posTokenData) return [];
    return positions.map((_, i) => {
      const tokenAddr = posTokenData[i]?.result as `0x${string}` | undefined;
      if (!tokenAddr) return null;
      return {
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: 'symbol',
        args: [],
      };
    }).filter(Boolean) as any[];
  }, [posTokenData, positions]);

  const { data: symbolsData } = useReadContracts({
    contracts: symbolContracts,
    query: {
      enabled: symbolContracts.length > 0,
    },
  });

  /* ---------------- ERC20 decimals ---------------- */
  const decimalsContracts = useMemo(() => {
    if (!posTokenData) return [];
    return positions.map((_, i) => {
      const tokenAddr = posTokenData[i]?.result as `0x${string}` | undefined;
      if (!tokenAddr) return null;
      return {
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: 'decimals',
        args: [],
      };
    }).filter(Boolean) as any[];
  }, [posTokenData, positions]);

  const { data: decimalsData } = useReadContracts({
    contracts: decimalsContracts,
    query: {
      enabled: decimalsContracts.length > 0,
    },
  });

  /* ---------------- Rows ---------------- */
  const rows: PositionRow[] = useMemo(() => {
    const built = positions.map((posId, i) => {
      const metaEntry: any = posMetaData?.[i];
      const tokenEntry: any = posTokenData?.[i];
      const balEntry: any = balancesData?.[i];
      const symEntry: any = symbolsData?.[i];
      const decEntry: any = decimalsData?.[i];

      const posName = metaEntry?.result?.[0] ?? '';
      const posTicker = metaEntry?.result?.[1] ?? '';
      const tokenAddress =
        (tokenEntry?.result as `0x${string}` | undefined) || null;

      const balRaw = (balEntry?.result as bigint | undefined) ?? 0n;
      const balance = Number(balRaw) / 1e6; // default decimals = 6 (UI only)

      const price = positionPrices[i];

      const erc20Symbol =
        (symEntry?.result as string | undefined) ?? null;

      const erc20DecimalsRaw =
        (decEntry?.result as number | bigint | undefined) ?? null;
      const erc20Decimals =
        erc20DecimalsRaw != null ? Number(erc20DecimalsRaw) : null;

      return {
        positionId: posId,
        name: posName,
        ticker: posTicker,
        tokenAddress,
        balance,
        price,
        erc20Symbol,
        erc20Decimals,
      };
    });

    console.log('[useMarketData] built rows', {
      marketId: id.toString(),
      rows: built.map((r) => ({
        positionId: r.positionId.toString(),
        ticker: r.ticker,
        erc20Symbol: r.erc20Symbol,
        erc20Decimals: r.erc20Decimals,
        balance: r.balance,
        price: r.price,
      })),
    });

    return built;
  }, [
    positions,
    posMetaData,
    posTokenData,
    balancesData,
    positionPrices,
    symbolsData,
    decimalsData,
    id,
  ]);

  /* ---------------- Sorting (delegated) ---------------- */
  const {
    sortedRows,
    sort,
    sortKey,
    sortDir,
  } = useSortedRows(rows);

  /* ---------------- Refetch all (after tx) ---------------- */
  const refetchAll = async () => {
    console.log('[useMarketData] refetchAll for market', id.toString());
    await Promise.allSettled([
      refetchMarketMeta?.(),
      refetchPositions?.(),
      refetchMarketPrices?.(),
      refetchPosMeta?.(),
      refetchPosTokens?.(),
      refetchBalances?.(),
    ]);
  };

  return {
    marketName,
    marketTicker,
    rows: sortedRows,
    reservePrice,
    sort,
    sortKey,
    sortDir,
    refetchAll,
  };
}
