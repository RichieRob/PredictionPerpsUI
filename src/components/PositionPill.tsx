// src/components/PositionPill/PositionPill.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { PriceBar } from './PriceBar';
import { TxStatusBanner } from './TxStatusBanner';
import { usePositionPill } from '../hooks/PositionPill/usePositionPill';

type PositionPillProps = {
  marketId: bigint;
  positionId: bigint;
  name: string;
  ticker: string;
  tokenAddress: `0x${string}`;
  balance: number;
  price: number | null;
  erc20Symbol: string;
  onAfterTx?: () => Promise<unknown> | void;
};

export function PositionPill({
  marketId,
  positionId,
  name,
  ticker,
  tokenAddress,
  balance,
  price,
  erc20Symbol,
  onAfterTx,
}: PositionPillProps) {
  const {
    size,
    setSize,
    side,
    setSide,
    isBusyBack,
    isBusyLay,
    handleTrade,
    handleAddToMetaMask,
    backStatus,
    layStatus,
    backErrorMessage,
    layErrorMessage,
  } = usePositionPill({
    marketId,
    positionId,
    tokenAddress,
    erc20Symbol,
    ticker,
    onAfterTx,
  });

  const clamped = price != null ? Math.max(0, Math.min(price, 1)) : null;
  const priceLabel = clamped != null ? `$${clamped.toFixed(6)}` : '–';
  const balanceLabel = Number.isFinite(balance) ? balance.toFixed(0) : '0';

  // Fade triggers
  const [fadePrice, setFadePrice] = useState(false);
  const [fadeBalance, setFadeBalance] = useState(false);

  useEffect(() => {
    if (price !== null) {
      setFadePrice(true);
      const timer = setTimeout(() => setFadePrice(false), 300);
      return () => clearTimeout(timer);
    }
  }, [price]);

  useEffect(() => {
    setFadeBalance(true);
    const timer = setTimeout(() => setFadeBalance(false), 300);
    return () => clearTimeout(timer);
  }, [balance]);

  const isBusyCurrent = side === 'back' ? isBusyBack : isBusyLay;

  return (
    <tr>
      <td>
        <div>
          <strong>{ticker || positionId.toString()}</strong>{' '}
          <span className="text-muted">{name}</span>
        </div>
      </td>

      <td className="text-end align-middle">
        <span
          style={{
            transition: 'opacity 0.3s ease',
            opacity: fadeBalance ? 0.5 : 1,
          }}
        >
          {balanceLabel}
        </span>
      </td>

      <td className="align-middle">
        <div className="d-flex flex-column">
          <div className="fw-semibold text-primary text-end mb-1">
            <span
              style={{
                transition: 'opacity 0.3s ease',
                opacity: fadePrice ? 0.5 : 1,
              }}
            >
              {priceLabel}
            </span>
          </div>
          <div className="d-flex justify-content-end">
            <PriceBar price={clamped} />
          </div>
        </div>
      </td>

      <td className="align-middle text-end">
        <div>
          <TxStatusBanner
            status={backStatus}
            errorMessage={backErrorMessage}
            successMessage="✅ Trade succeeded. Balances refreshed."
          />
          <TxStatusBanner
            status={layStatus}
            errorMessage={layErrorMessage}
            successMessage="✅ Trade succeeded. Balances refreshed."
          />

          <div className="d-flex justify-content-end align-items-center gap-2 mt-1">
            {/* Back/Lay toggle controlling how the ppUSDC input is interpreted */}
            <div
              className="btn-group btn-group-sm"
              role="group"
              aria-label="Back/Lay switch"
            >
              <button
                type="button"
                className={
                  side === 'back'
                    ? 'btn btn-sm btn-primary'
                    : 'btn btn-sm btn-outline-primary'
                }
                onClick={() => setSide('back')}
              >
                Back
              </button>
              <button
                type="button"
                className={
                  side === 'lay'
                    ? 'btn btn-sm btn-danger'
                    : 'btn btn-sm btn-outline-danger'
                }
                onClick={() => setSide('lay')}
              >
                Lay
              </button>
            </div>

            <input
              type="number"
              min="0"
              step="0.01"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="form-control form-control-sm"
              style={{ width: '100px' }}
              placeholder="ppUSDC"
            />

            <button
              type="button"
              className={
                side === 'back'
                  ? 'btn btn-sm btn-primary'
                  : 'btn btn-sm btn-danger'
              }
              onClick={handleTrade}
              disabled={isBusyCurrent}
            >
              {isBusyCurrent && (
                <span
                  className="spinner-border spinner-border-sm me-1"
                  role="status"
                  aria-hidden="true"
                />
              )}
              Trade
            </button>
          </div>
        </div>
      </td>

      <td className="align-middle text-end">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={handleAddToMetaMask}
        >
          Add
        </button>
      </td>
    </tr>
  );
}
