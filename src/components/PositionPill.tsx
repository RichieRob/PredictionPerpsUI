// src/components/PositionPill.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { TxStatusBanner } from './TxStatusBanner';
import { usePositionPill } from '../hooks/PositionPill/usePositionPill';
import { fmt } from '../utils/formatNumber';


type PositionPillProps = {
  marketId: bigint;
  positionId: bigint;
  name: string;
  ticker: string;
  tokenAddress: `0x${string}`;
  balance: number;
  price: number | null;      // Back price
  layPrice: number | null;   // Lay price
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
    isBusyLiquidate,
    handleTrade,
    handleLiquidate,
    handleAddToMetaMask,
    backStatus,
    layStatus,
    liqStatus,
    backErrorMessage,
    layErrorMessage,
    liqErrorMessage,
  } = usePositionPill({
    marketId,
    positionId,
    tokenAddress,
    erc20Symbol,
    ticker,
    backBalance: balance,  // 👈 pass Back exposure in tokens
    onAfterTx,
  });

  // Clamp prices
  const clampedBack =
    price != null ? Math.max(0, Math.min(price, 1)) : null;
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

  return (
    <tr>
      {/* Position name only */}
      <td>
        <div>
          <strong>{name || ticker || positionId.toString()}</strong>
        </div>
      </td>

      {/* Exposure + Liquidate button */}
      <td className="text-end align-middle">
        <div
          style={{
            transition: 'opacity 0.3s ease',
            opacity: fadeBalance ? 0.5 : 1,
            color: balance > 0 ? '#198754' : '#dc3545', // green / red
          }}
        >
{balance > 0 
  ? `+$${fmt(balance)}`
  : '$0'}

        </div>

        {balance > 0 && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary mt-1"
            onClick={handleLiquidate}
            disabled={isBusyLiquidate}
          >
            {isBusyLiquidate && (
              <span
                className="spinner-border spinner-border-sm me-1"
                role="status"
                aria-hidden="true"
              />
            )}
            Liquidate
          </button>
        )}
      </td>

      {/* Price: Back / Lay, prominent side on top */}
      <td className="align-middle">
        <div
          className="text-end"
          style={{
            transition: 'opacity 0.3s ease',
            opacity: fadePrice ? 0.5 : 1,
          }}
        >
          {side === 'back' ? (
            <>
              <div className="fw-semibold text-primary">
                Back&nbsp;{priceLabelBack}
              </div>
              <div className="small text-muted">
                Lay&nbsp;{priceLabelLay}
              </div>
            </>
          ) : (
            <>
              <div className="fw-semibold text-danger">
                Lay&nbsp;{priceLabelLay}
              </div>
              <div className="small text-muted">
                Back&nbsp;{priceLabelBack}
              </div>
            </>
          )}
        </div>
      </td>

      {/* Trade */}
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
          <TxStatusBanner               // 👈 liquidation banner
            status={liqStatus}
            errorMessage={liqErrorMessage}
            successMessage="✅ Liquidation succeeded. Balances refreshed."
          />

          <div className="d-flex justify-content-end align-items-center gap-2 mt-1">
            {/* Back/Lay toggle */}
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
              style={{ width: '90px' }}
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

      {/* Token button (Add Back / Add Lay handled in the hook) */}
      <td className="align-middle text-end">
        <button
          type="button"
          className={
            side === 'back'
              ? 'btn btn-sm btn-outline-primary'
              : 'btn btn-sm btn-outline-danger'
          }
          onClick={handleAddToMetaMask}
        >
          {side === 'back' ? 'Add Back' : 'Add Lay'}
        </button>
      </td>
    </tr>
  );
}
