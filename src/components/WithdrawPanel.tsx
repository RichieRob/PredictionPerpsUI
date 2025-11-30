// src/components/WithdrawPanel.tsx
'use client';

import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { CONTRACTS, ABIS } from '../config/contracts';
import { useLedgerTx } from '../hooks/useLedgerTx';
import { TxStatusBanner } from './TxStatusBanner';

type WithdrawPanelProps = {
  onAfterTx?: () => Promise<unknown> | void;
};

export function WithdrawPanel({ onAfterTx }: WithdrawPanelProps) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const chainKey = 'sepolia' as const;
  const { ledger } = CONTRACTS[chainKey];

  const {
    status,
    errorMessage,
    runTx,
    setErrorMessage,
  } = useLedgerTx({ onAfterTx });

  const isBusy = status === 'pending';

  const handleWithdraw = async () => {
    if (!address) {
      setErrorMessage('Wallet not connected.');
      return;
    }

    const amount = parseUnits('50', 6); // withdraw 50 USDC

    await runTx(() =>
      writeContractAsync({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'withdraw',
        args: [amount, address],
        gas: 3_000_000n,
      })
    );
  };

  const buttonLabel = (() => {
    if (status === 'pending') return 'Withdrawing…';
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

      <TxStatusBanner
        status={status}
        errorMessage={errorMessage}
        successMessage="✅ Withdraw succeeded. Balances refreshed."
      />

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
