// src/components/Markets.tsx
'use client';

import React, { useMemo } from 'react';
import { useReadContract, useReadContracts } from 'wagmi';
import { CONTRACTS, ABIS } from '../config/contracts';
import { PositionPill } from './PositionPill';
import { PriceBar } from './PriceBar';

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
          <MarketRow
            key={id.toString()}
            id={id}
            onAfterTx={onAfterTx}
          />
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
  const priceContracts = useMemo(() => {
    if (!lmsr) return [];
    const cs: any[] = [];

    // 1) one getBackPriceWad per position
    positions.forEach((posId) => {
      cs.push({
        address: lmsr as `0x${string}`,
        abi: ABIS.lmsr,
        functionName: 'getBackPriceWad',
        args: [id, posId],
      });
    });

    // 2) one getReservePriceWad for OTHER
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
    contracts: priceContracts,
    query: {
      enabled: priceContracts.length > 0,
      refetchInterval: 5_000, // poll for on-chain changes
    },
  });

  // --- Map position -> numeric price (0–1) ---
  type PosPrice = { positionId: bigint; price: number | null };

  const positionPrices: PosPrice[] = useMemo(() => {
    if (!pricesData || positions.length === 0) {
      return positions.map((posId) => ({ positionId: posId, price: null }));
    }

    return positions.map((posId, idx) => {
      const entry: any = pricesData[idx];
      const wad = entry?.result as bigint | undefined;
      if (wad === undefined) {
        return { positionId: posId, price: null };
      }
      const p = Number(wad) / 1e18;
      if (!Number.isFinite(p)) {
        return { positionId: posId, price: null };
      }
      return { positionId: posId, price: p };
    });
  }, [pricesData, positions]);

  // --- Sort positions by price desc (leaderboard) ---
  const sortedPositionPrices: PosPrice[] = useMemo(() => {
    return [...positionPrices].sort((a, b) => {
      const pa = a.price ?? -1;
      const pb = b.price ?? -1;
      return pb - pa;
    });
  }, [positionPrices]);

  // --- Reserve / OTHER price is last entry in pricesData ---
  let reserveLabel = '–';
  let reservePrice: number | null = null;
  let hasReserve = false;

  if (pricesData && pricesData.length > 0) {
    const reserveIdx = positions.length;
    const reserveEntry: any = pricesData[reserveIdx];
    const reserveRaw = reserveEntry?.result as bigint | undefined;
    if (reserveRaw !== undefined && reserveRaw > 0n) {
      hasReserve = true;
      const p = Number(reserveRaw) / 1e18;
      if (Number.isFinite(p)) {
        reservePrice = p;
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
        <div className="d-flex flex-column gap-2 mb-0">
          {/* LEADERBOARD POSITIONS (stacked vertically) */}
          {sortedPositionPrices.map(({ positionId, price }) => (
            <PositionPill
              key={positionId.toString()}
              marketId={id}
              positionId={positionId}
              price={price}
              onAfterTx={onAfterTx}
              onMarketPriceUpdate={handleMarketPriceUpdate}
            />
          ))}

          {/* OTHER PRICE with its own bar */}
          {hasReserve && (
            <div className="border rounded p-2 bg-light">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <div>
                  <strong>OTHER</strong>{' '}
                  <span className="text-muted">
                    Unlisted outcomes
                  </span>
                </div>
                <div className="fw-semibold text-primary">
                  {reserveLabel}
                </div>
              </div>
              <PriceBar price={reservePrice} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
