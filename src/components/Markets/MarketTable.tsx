// src/components/Markets/MarketTable.tsx
'use client';

import React from 'react';
import { useMarketData } from '../../hooks/useMarketData';
import { MarketTableView } from './MarketTableView';
import { ResolveMarketBox } from './ResolveMarketBox';

// Shared exposure formatter for OTHER row (0dp)
function formatExposure(value: number) {
  if (!Number.isFinite(value)) {
    return { label: '$0', className: 'text-danger' };
  }
  if (value > 0) {
    return {
      label: `+$${value.toFixed(0)}`,
      className: 'text-success',
    };
  }
  if (value < 0) {
    return {
      label: `-$${Math.abs(value).toFixed(0)}`,
      className: 'text-danger',
    };
  }
  return { label: '$0', className: 'text-danger' };
}

type MarketTableProps = {
  id: bigint;
  onAfterTx?: () => Promise<unknown> | void;
};

export function MarketTable({ id, onAfterTx }: MarketTableProps) {
  const {
    marketName,
    marketTicker, // kept if we want it later
    rows,
    reservePrice,
    reserveExposure,
    sort,
    sortKey,
    sortDir,
    refetchAll,
    isLoading,
    positionsLocked,
  } = useMarketData(id);

  const title = marketName || `Market #${id.toString()}`;

  // After a tx from any PositionPill: refetch this market + bubble up
  const handlePositionAfterTx = async () => {
    await refetchAll();
    if (onAfterTx) {
      await onAfterTx();
    }
  };

  // OTHER row view-model
  const hasReservePrice =
    typeof reservePrice === 'number' && reservePrice != null;

const showOtherRow = hasReservePrice && !positionsLocked;

  let otherBackLabel = '—';
  let otherLayLabel = '—';

  if (hasReservePrice) {
    const back = reservePrice as number;
    const lay = Math.max(0, Math.min(1, 1 - back));
    otherBackLabel = `$${back.toFixed(4)}`;
    otherLayLabel = `$${lay.toFixed(4)}`;
  }

  const { label: otherExposureLabel, className: otherExposureClassName } =
    formatExposure(reserveExposure);

  return (
    <>
      <MarketTableView
        id={id}
        title={title}
        rows={rows}
        sort={sort}
        sortKey={sortKey}
        sortDir={sortDir}
        isLoading={isLoading}
        onPositionAfterTx={handlePositionAfterTx}
        showOtherRow={showOtherRow}
        otherExposureLabel={otherExposureLabel}
        otherExposureClassName={otherExposureClassName}
        otherBackLabel={otherBackLabel}
        otherLayLabel={otherLayLabel}
      />

      <ResolveMarketBox marketId={id} onAfterTx={handlePositionAfterTx} />
    </>
  );
}
