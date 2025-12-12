// src/hooks/Markets/useSortedRows.tsx
'use client';

import { useMemo, useState, useEffect } from 'react';
import type { PositionRow } from './useMarketData';

export type SortKey = 'name' | 'balance' | 'layBalance' | 'price';
export type SortDir = 'asc' | 'desc';

function sortRows(
  rows: PositionRow[],
  key: SortKey,
  dir: SortDir
): PositionRow[] {
  const arr = [...rows];

  arr.sort((a, b) => {
    let av: number | string;
    let bv: number | string;

    if (key === 'name') {
      av = (a.ticker || a.name || '').toLowerCase();
      bv = (b.ticker || b.name || '').toLowerCase();
    } else if (key === 'balance') {
      av = a.balance;
      bv = b.balance;
    } else if (key === 'layBalance') {
      av = a.layBalance;
      bv = b.layBalance;
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

    return dir === 'asc' ? cmp : -cmp;
  });

  return arr;
}

export function useSortedRows(rows: PositionRow[]) {
  const [sortKey, setSortKey] = useState<SortKey>('price');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Persistent order of positionIds – this keeps the list stable
  const [order, setOrder] = useState<bigint[]>([]);

  // Map id -> latest row data
  const rowMap = useMemo(() => {
    const m = new Map<string, PositionRow>();
    for (const r of rows) {
      m.set(r.positionId.toString(), r);
    }
    return m;
  }, [rows]);

  // Initialise & maintain membership of `order` without re-sorting on data changes
  useEffect(() => {
    if (rows.length === 0) {
      if (order.length !== 0) setOrder([]);
      return;
    }

    // First time we see rows: apply default sort (current sortKey/sortDir) ONCE
    if (order.length === 0) {
      const initial = sortRows(rows, sortKey, sortDir);
      setOrder(initial.map((r) => r.positionId));
      return;
    }

    // From here on: keep the same order, just
    //  - drop ids that disappeared
    //  - append any brand new ids to the end
    const existingIds = new Set(rows.map((r) => r.positionId.toString()));

    const filtered: bigint[] = [];
    for (const id of order) {
      if (existingIds.has(id.toString())) {
        filtered.push(id);
      }
    }

    const known = new Set(filtered.map((id) => id.toString()));
    const missing: bigint[] = [];
    for (const r of rows) {
      const key = r.positionId.toString();
      if (!known.has(key)) {
        missing.push(r.positionId);
      }
    }

    const newOrder = [...filtered, ...missing];

    // Only update state if the order actually changed
    if (newOrder.length !== order.length) {
      setOrder(newOrder);
    } else {
      let same = true;
      for (let i = 0; i < newOrder.length; i++) {
        if (newOrder[i] !== order[i]) {
          same = false;
          break;
        }
      }
      if (!same) setOrder(newOrder);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]); // intentionally NOT depending on order/sortKey/sortDir

  function sort(key: SortKey) {
    // Decide new sort key + direction based on current state
    let nextKey: SortKey = key;
    let nextDir: SortDir;

    if (key === sortKey) {
      // Toggle direction
      nextDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      // New column: default direction
      nextDir = key === 'name' ? 'asc' : 'desc';
    }

    const sorted = sortRows(rows, nextKey, nextDir);
    setOrder(sorted.map((r) => r.positionId));
    setSortKey(nextKey);
    setSortDir(nextDir);
  }

  // Apply the persistent order to current rows
  const sortedRows = useMemo(() => {
    if (order.length === 0) return rows;

    const out: PositionRow[] = [];
    const used = new Set<string>();

    for (const id of order) {
      const key = id.toString();
      const row = rowMap.get(key);
      if (row) {
        out.push(row);
        used.add(key);
      }
    }

    // Append any rows that aren't in `order` yet (paranoid safety)
    for (const r of rows) {
      const key = r.positionId.toString();
      if (!used.has(key)) {
        out.push(r);
      }
    }

    return out;
  }, [rows, order, rowMap]);

  return {
    sortedRows,
    sort,
    sortKey,
    sortDir,
  };
}
