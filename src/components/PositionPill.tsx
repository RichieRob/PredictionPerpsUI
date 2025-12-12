// src/components/PositionPill/PositionPill.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { TxStatusBanner } from './TxStatusBanner';
import { usePositionPill } from '../hooks/PositionPill/usePositionPill';

type PositionPillProps = {
  marketId: bigint;
  positionId: bigint;
  name: string;
  ticker: string;
  tokenAddress: `0x${string}`;
  balance: number;
  price: number | null;      // Back price
  layPrice: number | null;  // Lay price (from LMSR)
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
  layPrice,
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

  // Back / Lay clamped to [0,1]
  const clampedBack = price != null ? Math.max(0, Math.min(price, 1)) : null;
  const clampedLay =
    layPrice != null ? Math.max(0, Math.min(layPrice, 1)) : null;

  const priceLabelBack =
    clampedBack != null ? `$${clampedBack.toFixed(4)}` : '–';
  const priceLabelLay =
    clampedLay != null ? `$${clampedLay.toFixed(4)}` : '–';

  const balanceLabel = Number.isFinite(balance) ? balance.toFixed(0) : '0';

  // Fade triggers
  const [fadePrice, setFadePrice] = useState(false);
  const [fadeBalance, setFadeBalance] = useState(false);

  useEffect(() => {
    // Fade whenever either price moves
    if (price !== null || layPrice !== null) {
      setFadePrice(true);
      const timer = setTimeout(() => setFadePrice(false), 300);
      return () => clearTimeout(timer);
    }
  }, [price, layPrice]);

  useEffect(() => {
    setFadeBalance(true);
    const timer = setTimeout(() => setFadeBalance(false), 300);
    return () => clearTimeout(timer);
  }, [balance]);

  const isBusyCurrent = side === 'back' ? isBusyBack : isBusyLay;

  // Decide which one is prominent (top) based on current side
  const isBackProminent = side === 'back';

  const topLabel = isBackProminent
    ? `Back ${priceLabelBack}`
    : `Lay ${priceLabelLay}`;

  const bottomLabel = isBackProminent
    ? `Lay ${priceLabelLay}`
    : `Back ${priceLabelBack}`;

  const topClass = isBackProminent
    ? 'fw-semibold text-primary'
    : 'fw-semibold text-danger'; // blue for back, red for lay

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
        <div
          className="text-end"
          style={{
            transition: 'opacity 0.3s ease',
            opacity: fadePrice ? 0.5 : 1,
          }}
        >
          <div className={topClass}>{topLabel}</div>
          <div className="small text-muted">{bottomLabel}</div>
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
            {/* Back/Lay toggle controlling how the ppUSDC input is interpreted
                AND which price is prominent */}
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
