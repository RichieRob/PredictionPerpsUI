'use client';

import { useReadContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../config/contracts';

type MarketsProps = {
  marketIds: bigint[];
};

export function Markets({ marketIds }: MarketsProps) {
  return (
    <section className="mt-4">
      <h2 className="h5 mb-3">Markets</h2>
      {marketIds.length === 0 && (
        <p className="text-muted">No markets found.</p>
      )}
      <div className="list-group">
        {marketIds.map((id) => (
          <MarketRow key={id.toString()} id={id} />
        ))}
      </div>
    </section>
  );
}

function MarketRow({ id }: { id: bigint }) {
  const { ledger } = CONTRACTS.sepolia;

  const { data: marketData } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getMarketDetails',
    args: [id],
  });

  const [name, ticker] = (marketData || []) as [string, string];

  const { data: positionsRaw } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getMarketPositions',
    args: [id],
  });

  const positions = (positionsRaw as bigint[] | undefined) || [];

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

      {positions.length > 0 && (
        <ul className="list-inline mb-0">
          {positions.map((posId) => (
            <li
              key={posId.toString()}
              className="list-inline-item me-3 mb-1"
            >
              <PositionPill marketId={id} positionId={posId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PositionPill({
  marketId,
  positionId,
}: {
  marketId: bigint;
  positionId: bigint;
}) {
  const { ledger } = CONTRACTS.sepolia;

  const { data } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getPositionDetails',
    args: [marketId, positionId],
  });

  const [name, ticker] = (data || []) as [string, string];

  return (
    <span className="badge bg-light text-dark border">
      <strong>{ticker || positionId.toString()}</strong>{' '}
      <span className="text-muted">{name}</span>
    </span>
  );
}
