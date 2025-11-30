// src/components/Markets.tsx
'use client';

import React, { useMemo } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS, ABIS } from '../config/contracts';
import { PositionPill } from './PositionPill';

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
          <MarketRow key={id.toString()} id={id} onAfterTx={onAfterTx} />
        ))}
      </div>
    </section>
  );
}

function MarketRow({
  id,
  onAfterTx,
}: {
  id: bigint;
  onAfterTx?: () => Promise<unknown> | void;
}) {
  const { ledger, lmsr } = CONTRACTS.sepolia;

  // --- Market name + ticker ---
  const { data: marketData } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getMarketDetails',
    args: [id],
  });

  const [name, ticker] = (marketData || []) as [string, string];

  // --- Positions for this market ---
  const { data: positionsRaw } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getMarketPositions',
    args: [id],
  });

  const positions = (positionsRaw as bigint[] | undefined) || [];

  // --- Bundle ALL prices for this market (each position + OTHER) ---
  const contracts = useMemo(() => {
    const cs: any[] = [];

    positions.forEach((posId) => {
      cs.push({
        address: lmsr as `0x${string}`,
        abi: ABIS.lmsr,
        functionName: 'getBackPriceWad',
        args: [id, posId],
      });
    });

    cs.push({
      address: lmsr as `0x${string}`,
      abi: ABIS.lmsr,
      functionName: 'getReservePriceWad',
      args: [id],
    });

    return cs;
  }, [positions, lmsr, id]);

  const {
    data: pricesData,
    refetch: refetchMarketPrices,
  } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
    },
  });

  const getPriceLabelForIndex = (idx: number): string => {
    if (!pricesData || !pricesData[idx]) return '–';
    const entry: any = pricesData[idx];
    const wad = entry?.result as bigint | undefined;
    if (wad === undefined) return '–';
    const p = Number(wad) / 1e18;
    if (!Number.isFinite(p)) return '–';
    return `$${p.toFixed(3)}`;
  };

  // Reserve / OTHER is last entry
  let reserveLabel = '–';
  let hasReserve = false;
  if (pricesData && pricesData.length > 0) {
    const reserveIdx = positions.length;
    const reserveEntry: any = pricesData[reserveIdx];
    const reserveRaw = reserveEntry?.result as bigint | undefined;
    if (reserveRaw !== undefined && reserveRaw > 0n) {
      hasReserve = true;
      const p = Number(reserveRaw) / 1e18;
      if (Number.isFinite(p)) {
        reserveLabel = `$${p.toFixed(3)}`;
      }
    }
  }

  const handleMarketPriceUpdate = async () => {
    await refetchMarketPrices();
  };

  return (
    <div className="list-group-item">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <div>
          <div>{name || `Market #${id.toString()}`}</div>
          <small className="text-muted">{ticker}</small>
        </div>
        <span className="badge bg-secondary">
          {positions.length} positions
        </span>
      </div>

      {(positions.length > 0 || hasReserve) && (
        <ul className="list-inline mb-0">
          {positions.map((posId, idx) => {
            const priceLabel = getPriceLabelForIndex(idx);
            return (
              <li
                key={posId.toString()}
                className="list-inline-item me-3 mb-1"
              >
                <PositionPill
                  marketId={id}
                  positionId={posId}
                  priceLabel={priceLabel}
                  onAfterTx={onAfterTx}
                  onMarketPriceUpdate={handleMarketPriceUpdate}
                />
              </li>
            );
          })}

          {hasReserve && (
            <li className="list-inline-item me-3 mb-1">
              <span className="badge bg-light text-dark border">
                <strong>OTHER</strong>{' '}
                <span className="text-muted">Unlisted outcomes</span>{' '}
                <span className="ms-1 text-primary fw-semibold">
                  {reserveLabel}
                </span>
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
