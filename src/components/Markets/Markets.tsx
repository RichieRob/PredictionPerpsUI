// src/components/Markets/Markets.tsx
'use client';

import { MarketTable } from './MarketTable';  // Import the split table

type MarketsProps = {
  marketIds: bigint[];
  onAfterTx?: () => Promise<unknown> | void;
};

export function Markets({ marketIds, onAfterTx }: MarketsProps) {
  return (
    <section className="mt-4">
      <h2 className="h5 mb-3">Markets</h2>

      {marketIds.length === 0 && (
        <p className="text-muted">No markets found.</p>
      )}

      <div className="list-group">
        {marketIds.map((id) => (
          <MarketTable
            key={id.toString()}
            id={id}
            onAfterTx={onAfterTx}
          />
        ))}
      </div>
    </section>
  );
}