// src/components/Markets/Markets.tsx
'use client';

import React from 'react';
import { useMarketData } from './useMarketData';
import { PositionPill } from '../PositionPill';
import { PriceBar } from '../PriceBar';

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

function MarketTable({
  id,
  onAfterTx,
}: {
  id: bigint;
  onAfterTx?: () => Promise<unknown> | void;
}) {
  const {
    marketName,
    marketTicker,
    rows,
    reservePrice,
    sort,
    sortKey,
    sortDir,
    refetchAll,
  } = useMarketData(id);

  const icon = (k: string) =>
    sortKey !== k ? '↕' : sortDir === 'asc' ? '↑' : '↓';

  const handleAfterTx = async () => {
    await Promise.allSettled([
      refetchAll(),
      onAfterTx?.(),
    ]);
  };

  return (
    <div className="list-group-item mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div>
          <div>{marketName || `Market #${id.toString()}`}</div>
          <small className="text-muted">{marketTicker}</small>
        </div>
        <div className="text-muted small">
          Market ID: {id.toString()}
        </div>
      </div>

      <div className="table-responsive mb-2">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th>
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => sort('name')}
                >
                  Position {icon('name')}
                </button>
              </th>
              <th className="text-end">
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => sort('balance')}
                >
                  Balance {icon('balance')}
                </button>
              </th>
              <th className="text-end">
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => sort('price')}
                >
                  Price {icon('price')}
                </button>
              </th>
              <th className="text-end">Trade</th>
              <th className="text-end">Token</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <PositionPill
                key={row.positionId.toString()}
                marketId={id}
                positionId={row.positionId}
                name={row.name}
                ticker={row.ticker}
                tokenAddress={row.tokenAddress}
                balance={row.balance}
                price={row.price}
                erc20Symbol={row.erc20Symbol}
                erc20Decimals={row.erc20Decimals}
                onAfterTx={handleAfterTx}
              />
            ))}
          </tbody>
        </table>
      </div>

      {reservePrice != null && (
        <div className="border rounded p-2 bg-light">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <div>
              <strong>OTHER</strong>{' '}
              <span className="text-muted">Unlisted outcomes</span>
            </div>
            <div className="fw-semibold text-primary">
              ${reservePrice.toFixed(3)}
            </div>
          </div>
          <PriceBar price={reservePrice} />
        </div>
      )}
    </div>
  );
}
