// src/components/Markets/MarketTable.tsx
'use client';

import React, { useState } from 'react';
import { useMarketData } from './useMarketData';
import { PositionPill } from '../PositionPill';
import { PriceBar } from '../PriceBar';
import { addTokensToMetaMask } from '../../utils/addTokenToMetaMask';
// src/components/Markets/MarketTable.tsx

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

  // Show spinner only for initial load; for refreshes, show in header without hiding table
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