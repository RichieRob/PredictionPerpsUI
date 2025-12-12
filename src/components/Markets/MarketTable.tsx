// src/components/Markets/MarketTable.tsx
'use client';

import React, { useState } from 'react';
import { useMarketData } from './useMarketData';
import { PositionPill } from '../PositionPill';
import { addTokensToMetaMask } from '../../utils/addTokenToMetaMask';

type MarketTableProps = {
  id: bigint;
  onAfterTx?: () => Promise<unknown> | void;
};

export function MarketTable({ id, onAfterTx }: MarketTableProps) {
  const {
    marketName,
    marketTicker,
    rows,
    reservePrice,
    reserveExposure, // OTHER exposure (number, 6dp scaled)
    sort,
    sortKey,
    sortDir,
    refetchAll,
    isLoading,
  } = useMarketData(id);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingTokens, setIsAddingTokens] = useState(false);

  const icon = (k: string) =>
    sortKey !== k ? '↕' : sortDir === 'asc' ? '↑' : '↓';

  const runRefresh = async (withGlobal?: boolean) => {
    setIsRefreshing(true);
    try {
      await refetchAll();

      if (withGlobal && onAfterTx) {
        await onAfterTx();
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAfterTx = async () => {
    await runRefresh(true);
  };

  const handleManualRefresh = async () => {
    await runRefresh(false);
  };

  const handleAddAllToMetaMask = async () => {
    setIsAddingTokens(true);
    try {
      const tokens = rows.map((row) => ({
        address: row.tokenAddress as `0x${string}`,
        symbol: row.erc20Symbol as string,
        decimals: 6,
      }));

      const results = await addTokensToMetaMask(tokens);
      const allSucceeded = results.every((r) => r);
      console.log('[MarketTable] Batch add to MetaMask results:', results);

      if (allSucceeded) {
        alert('All tokens added to MetaMask successfully!');
      } else {
        alert('Some tokens failed to add. Check console for details.');
      }
    } catch (err) {
      console.error('[MarketTable] Error adding tokens:', err);
      alert('Failed to add tokens to MetaMask.');
    } finally {
      setIsAddingTokens(false);
    }
  };

  // Initial load spinner
  if (isLoading) {
    return (
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
    );
  }

  const hasReservePrice = typeof reservePrice === 'number';

  // Lay(OTHER) = 1 - price(OTHER)
  const otherLayPrice =
    hasReservePrice && reservePrice != null
      ? Math.max(0, Math.min(1, 1 - reservePrice))
      : null;
  const otherBackLabel =
    hasReservePrice && reservePrice != null
      ? `$${reservePrice.toFixed(4)}`
      : '—';
  const otherLayLabel =
    otherLayPrice != null ? `$${otherLayPrice.toFixed(4)}` : '—';

  return (
    <div className="list-group-item mb-3">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div>
          <div>{marketName || `Market #${id.toString()}`}</div>
          <small className="text-muted">{marketTicker}</small>
        </div>
        <div className="d-flex align-items-center gap-2">
          <small className="text-muted me-2">
            Market ID: {id.toString()}
          </small>
          {isRefreshing && (
            <span
              className="spinner-border spinner-border-sm text-secondary"
              role="status"
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
          >
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={handleAddAllToMetaMask}
            disabled={isAddingTokens || rows.length === 0}
          >
            {isAddingTokens && (
              <span
                className="spinner-border spinner-border-sm me-1"
                role="status"
                aria-hidden="true"
              />
            )}
            Add All to MetaMask
          </button>
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
                  Exposure {icon('balance')}
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
                key={row.tokenAddress}
                marketId={id}
                positionId={row.positionId}
                name={row.name}
                ticker={row.ticker}
                tokenAddress={row.tokenAddress}
                balance={row.balance}
                price={row.price}
                layPrice={row.layPrice}
                erc20Symbol={row.erc20Symbol}
                onAfterTx={handleAfterTx}
              />
            ))}

            {hasReservePrice && (
              <tr>
                {/* Name / label */}
                <td>
                  <div>
                    <strong>OTHER</strong>{' '}
                    <span className="text-muted">Unlisted outcomes</span>
                  </div>
                </td>

                {/* Balance (use same precision as normal rows) */}
                <td className="text-end align-middle">
                  {reserveExposure.toFixed(0)}
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

                {/* Empty Trade column */}
                <td className="align-middle text-end">—</td>

                {/* Empty Token column */}
                <td className="align-middle text-end">—</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
