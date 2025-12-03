
// src/components/Markets/useSortedRows.tsx (no changes needed, but ensure PositionRow import matches)
'use client';

import { useMemo, useState } from 'react';
import type { PositionRow } from './useMarketData';

export type SortKey = 'name' | 'balance' | 'price';
export type SortDir = 'asc' | 'desc';

export function useSortedRows(rows: PositionRow[]) {
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function sort(key: SortKey) {
    if (key === sortKey) {
      // toggle direction
      setSortDir((prev) => {
        const next = prev === 'asc' ? 'desc' : 'asc';
        console.log('[useSortedRows] toggling direction', {
          key,
          prevDir: prev,
          nextDir: next,
        });
        return next;
      });
    } else {
      // switch key + default direction
      const defaultDir: SortDir = key === 'name' ? 'asc' : 'desc';
      console.log('[useSortedRows] switching key', {
        prevKey: sortKey,
        nextKey: key,
        defaultDir,
      });
      setSortKey(key);
      setSortDir(defaultDir);
    }
  }

  const sortedRows = useMemo(() => {
    const arr = [...rows];

    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;

      if (sortKey === 'name') {
        av = (a.ticker || a.name || '').toLowerCase();
        bv = (b.ticker || b.name || '').toLowerCase();
      } else if (sortKey === 'balance') {
        av = a.balance;
        bv = b.balance;
      } else {
        // price
        av = a.price ?? -1;
        bv = b.price ?? -1;
      }

      let cmp: number;
      if (typeof av === 'string' && typeof bv === 'string') {
        cmp = av.localeCompare(bv);
      } else {
        cmp = (av as number) - (bv as number);
      }

      return sortDir === 'asc' ? cmp : -cmp;
    });

    console.log('[useSortedRows] applying sort', {
      sortKey,
      sortDir,
      sample: arr.slice(0, 3).map((r) => ({
        positionId: r.positionId.toString(),
        ticker: r.ticker,
        balance: r.balance,
        price: r.price,
      })),
    });

    return arr;
  }, [rows, sortKey, sortDir]);

  return {
    sortedRows,
    sort,
    sortKey,
    sortDir,
  };
}