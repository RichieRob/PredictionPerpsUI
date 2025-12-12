// src/components/Markets/MarketTableView.tsx
'use client';

import React from 'react';
import { PositionPill } from '../PositionPill';
import type {
  PositionRow,
  SortKey,
  SortDir,
} from '../../hooks/useMarketData';

type MarketTableViewProps = {
  id: bigint;
  title: string;
  rows: PositionRow[];
  sort: (key: SortKey) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  isLoading: boolean;
  onPositionAfterTx?: () => Promise<unknown> | void;

  // Precomputed OTHER row view-model
  showOtherRow: boolean;
  otherExposureLabel: string;
  otherExposureClassName: string;
  otherBackLabel: string;
  otherLayLabel: string;
};

export function MarketTableView({
  id,
  title,
  rows,
  sort,
  sortKey,
  sortDir,
  isLoading,
  onPositionAfterTx,
  showOtherRow,
  otherExposureLabel,
  otherExposureClassName,
  otherBackLabel,
  otherLayLabel,
}: MarketTableViewProps) {
  const icon = (k: SortKey) =>
    sortKey !== k ? '↕' : sortDir === 'asc' ? '↑' : '↓';

  if (isLoading) {
    return (
      <div className="list-group-item mb-4">
        <div className="text-center py-3">
          <span
            className="spinner-border text-secondary"
            role="status"
            aria-hidden="true"
          />
          <div className="text-muted mt-2">
            Loading prices &amp; balances…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="list-group-item mb-4">
      {/* Fancy, centered, Bootstrap-styled title */}
      <div className="mb-4 text-center">
        <h3 className="fw-bold text-primary mb-1">{title}</h3>
        <div className="border-bottom mx-auto" style={{ width: '60px' }} />
      </div>

      <div className="table-responsive mb-2">
        <table className="table table-sm align-middle mb-0">
          <thead>
            <tr>
              <th className="w-25">
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => sort('name')}
                >
                  Position {icon('name')}
                </button>
              </th>
              <th className="text-end" style={{ width: '12rem' }}>
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => sort('balance')}
                >
                  Exposure {icon('balance')}
                </button>
              </th>
              <th className="text-end" style={{ width: '12rem' }}>
                Lay Exposure
              </th>
              <th className="text-end" style={{ width: '14rem' }}>
                <button
                  type="button"
                  className="btn btn-link p-0 text-decoration-none"
                  onClick={() => sort('price')}
                >
                  Price {icon('price')}
                </button>
              </th>
              <th className="text-end" style={{ width: '10rem' }}>
                Trade
              </th>
              <th className="text-end" style={{ width: '9rem' }}>
                Token
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <PositionPill
                key={row.tokenAddress}
                marketId={id}
                positionId={row.positionId}
                name={row.name}
                ticker={row.ticker}
                tokenAddress={row.tokenAddress}
                balance={row.balance}
                layBalance={row.layBalance}
                price={row.price}
                layPrice={row.layPrice}
                erc20Symbol={row.erc20Symbol}
                onAfterTx={onPositionAfterTx}
              />
            ))}

            {showOtherRow && (
              <tr>
                {/* Name / label */}
                <td>
                  <div
                    className="text-truncate"
                    title="OTHER – Unlisted outcomes"
                  >
                    <span className="fw-semibold">OTHER</span>{' '}
                    <span className="text-muted">Unlisted outcomes</span>
                  </div>
                </td>

                {/* Exposure */}
                <td className="text-end align-middle">
                  <span className={otherExposureClassName}>
                    {otherExposureLabel}
                  </span>
                </td>

                {/* Lay Exposure (no value for OTHER) */}
                <td className="text-end align-middle">
                  <span className="text-muted">$0</span>
                </td>

                {/* Price column: Back + Lay text, Back prominent */}
                <td className="align-middle">
                  <div className="text-end">
                    <div className="fw-semibold text-primary">
                      Back&nbsp;{otherBackLabel}
                    </div>
                    <div className="small text-muted">
                      Lay&nbsp;{otherLayLabel}
                    </div>
                  </div>
                </td>

                {/* Empty Trade / Token cells */}
                <td className="align-middle text-end">—</td>
                <td className="align-middle text-end">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
