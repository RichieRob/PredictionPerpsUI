'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits } from 'viem';
import { CONTRACTS, ABIS } from '../config/contracts';

type WithdrawPanelProps = {
  onAfterTx?: () => Promise<unknown> | void;
};

type Status = 'idle' | 'withdrawing' | 'success' | 'error';

export function WithdrawPanel({ onAfterTx }: WithdrawPanelProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const chainKey = 'sepolia' as const;
  const { ledger } = CONTRACTS[chainKey];

  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = status === 'withdrawing';

  const handleWithdraw = async () => {
    if (!address) {
      setErrorMessage('Wallet not connected.');
      return;
    }
    if (!publicClient) {
      setErrorMessage('RPC client not ready.');
      return;
    }
    if (isBusy) return;

    setErrorMessage(null);
    setStatus('withdrawing');

    try {
      const amount = parseUnits('50', 6); // withdraw 50 USDC

      const txHash = await writeContractAsync({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'withdraw',
        args: [amount, address],
        gas: 3_000_000n,
      });

      console.log('✅ withdraw tx hash:', txHash);

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setStatus('success');

      if (onAfterTx) {
        await onAfterTx();
      }
    } catch (err: any) {
      console.error('❌ Withdraw failed:', err);
      const short =
        err?.shortMessage ||
        err?.cause?.shortMessage ||
        err?.cause?.details ||
        err?.message ||
        'Transaction failed';
      setErrorMessage(short);
      setStatus('error');
    }
  };

  const buttonLabel = (() => {
    if (status === 'withdrawing') return 'Withdrawing…';
    if (status === 'success') return 'Withdrawn ✔';
    if (status === 'error') return 'Try again';
    return 'Withdraw 50 USDC';
  })();

  return (
    <section className="mb-4">
      <h2 className="h5">Withdraw</h2>
      <p className="mb-2 text-muted">
        Withdraw USDC from the Ledger back to your wallet using the{' '}
        <code>withdraw</code> entrypoint.
      </p>

      {errorMessage && (
        <div className="alert alert-danger py-2">
          <strong>Withdraw error:</strong> {errorMessage}
        </div>
      )}

      {status === 'success' && !errorMessage && (
        <div className="alert alert-success py-2">
          ✅ Withdraw succeeded. Balances refreshed.
        </div>
      )}

      <button
        type="button"
        className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center"
        onClick={handleWithdraw}
        disabled={isBusy}
      >
        {isBusy && (
          <span
            className="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          />
        )}
        {buttonLabel}
      </button>
    </section>
  );
}
