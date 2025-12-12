// src/components/Markets/ResolveMarketBox.tsx
'use client';

import React, { useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../../config/contracts';
import { TxStatusBanner } from '../TxStatusBanner';

type TxStatus = 'idle' | 'pending' | 'success' | 'error';

type Props = {
  marketId: bigint;
  onAfterTx?: () => Promise<unknown> | void;
};

function parseUintStrict(s: string): bigint | null {
  const t = s.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  try {
    return BigInt(t);
  } catch {
    return null;
  }
}

export function ResolveMarketBox({ marketId, onAfterTx }: Props) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const oracleAddress = CONTRACTS.sepolia.mockOracle as `0x${string}`;
  const ledgerAddress = CONTRACTS.sepolia.ledger as `0x${string}`;

  const [winnerInput, setWinnerInput] = useState('');
  const [status, setStatus] = useState<TxStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [step, setStep] = useState<string>('');

  const isBusy = status === 'pending';

  const runResolve = async () => {
    if (!publicClient) {
      setStatus('error');
      setErrorMessage('RPC client not ready.');
      return;
    }

    const winner = parseUintStrict(winnerInput);
    if (winner === null) {
      setStatus('error');
      setErrorMessage('Enter a numeric winning positionId.');
      return;
    }

    setErrorMessage(null);
    setStatus('pending');

    try {
      // 1) pushResolution(marketId, winner)
      setStep('Pushing oracle resolution…');
      const oracleHash = await writeContractAsync({
        address: oracleAddress,
        abi: ABIS.mockOracle,
        functionName: 'pushResolution',
        args: [marketId, winner],
      });
      await publicClient.waitForTransactionReceipt({ hash: oracleHash });

      // 2) ledger.resolveMarket(marketId)
      setStep('Resolving market on ledger…');
      const ledgerHash = await writeContractAsync({
        address: ledgerAddress,
        abi: ABIS.ledger,
        functionName: 'resolveMarket',
        args: [marketId],
      });
      await publicClient.waitForTransactionReceipt({ hash: ledgerHash });

      setStep('');
      setStatus('success');

      if (onAfterTx) {
        await onAfterTx();
      }
    } catch (err: any) {
      const short =
        err?.shortMessage ||
        err?.cause?.shortMessage ||
        err?.cause?.details ||
        err?.message ||
        'Transaction failed';

      setStep('');
      setStatus('error');
      setErrorMessage(short);
    }
  };

  return (
    <div className="card mt-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="fw-semibold">Resolve (debug)</div>
          <span className="text-muted small">Market #{marketId.toString()}</span>
        </div>

        <TxStatusBanner
          status={status}
          errorMessage={errorMessage}
          successMessage="✅ Market resolved."
        />
        {step && <div className="text-muted small mt-1">{step}</div>}

        <div className="row g-2 align-items-end mt-2">
          <div className="col-sm-6 col-md-4">
            <label className="form-label small mb-1">Winning positionId</label>
            <input
              className="form-control form-control-sm"
              value={winnerInput}
              onChange={(e) => setWinnerInput(e.target.value)}
              placeholder="e.g. 0"
              disabled={isBusy}
            />
          </div>

          <div className="col-sm-6 col-md-4">
            <button
              type="button"
              className="btn btn-sm btn-outline-danger w-100"
              onClick={runResolve}
              disabled={isBusy}
            >
              {isBusy && (
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                />
              )}
              Push + Resolve
            </button>
          </div>

          <div className="col-12 col-md-4">
            <div className="text-muted small">
              Calls <code>MockOracle.pushResolution</code> then{' '}
              <code>Ledger.resolveMarket(marketId)</code>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
