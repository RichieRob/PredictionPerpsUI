// src/hooks/useLedgerTx.ts
'use client';

import { usePublicClient } from 'wagmi';
import { useResettableStatus } from './useResettableStatus';

export type TxStatus = 'idle' | 'pending' | 'success' | 'error';

type UseLedgerTxArgs = {
  // Global after-tx handler (e.g. refresh top-level balances / markets)
  onAfterTx?: () => Promise<unknown> | void;
};

type RunTxOptions = {
  // Extra “local” refreshes for this specific component (e.g. position balance, market prices)
  onLocalAfterTx?: () => Promise<unknown> | void;
};

export function useLedgerTx({ onAfterTx }: UseLedgerTxArgs) {
  const publicClient = usePublicClient();

  const {
    status,
    setStatus,
    errorMessage,
    setErrorMessage,
  } = useResettableStatus<TxStatus>('idle');

  const runTx = async (
    send: () => Promise<`0x${string}`>,
    options?: RunTxOptions
  ) => {
    if (!publicClient) {
      setErrorMessage('RPC client not ready.');
      return;
    }

    setErrorMessage(null);
    setStatus('pending');

    try {
      const txHash = await send();
      console.log('📡 Ledger tx hash:', txHash);

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      // 1) Local component-level refresh
      if (options?.onLocalAfterTx) {
        await options.onLocalAfterTx();
      }

      // 2) Global app-level refresh from page.tsx
      if (onAfterTx) {
        await onAfterTx();
      }

      setStatus('success');
    } catch (err: any) {
      console.error('❌ Ledger tx failed:', err);
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

  return {
    status,
    errorMessage,
    setErrorMessage,
    runTx,
  };
}
