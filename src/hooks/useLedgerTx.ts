// src/hooks/useLedgerTx.ts
'use client';

import { usePublicClient } from 'wagmi';
import { useResettableStatus } from './useResettableStatus';

export type TxStatus = 'idle' | 'pending' | 'success' | 'error';

type UseLedgerTxArgs = {
  onAfterTx?: () => Promise<unknown> | void;
};

type RunTxOptions = {
  onLocalAfterTx?: () => Promise<unknown> | void;
};

function pickViemMessage(err: any): string {
  // viem error shapes vary; these are the ones that usually contain the real reason.
  const meta =
    err?.cause?.metaMessages ||
    err?.metaMessages ||
    err?.cause?.cause?.metaMessages ||
    null;

  if (Array.isArray(meta) && meta.length) {
    // Often includes "Error: <reason>" or custom error hints
    return meta.join('\n');
  }

  const reason =
    err?.cause?.reason ||
    err?.cause?.cause?.reason ||
    err?.reason ||
    null;

  if (typeof reason === 'string' && reason.trim()) return reason;

  const short =
    err?.shortMessage ||
    err?.cause?.shortMessage ||
    err?.cause?.details ||
    err?.details ||
    err?.message ||
    'Transaction failed';

  return short;
}

export function useLedgerTx({ onAfterTx }: UseLedgerTxArgs) {
  const publicClient = usePublicClient();

  const { status, setStatus, errorMessage, setErrorMessage } =
    useResettableStatus<TxStatus>('idle');

  const runTx = async (
    send: () => Promise<`0x${string}`>,
    options?: RunTxOptions
  ) => {
    if (!publicClient) {
      setErrorMessage('RPC client not ready.');
      return null;
    }

    setErrorMessage(null);
    setStatus('pending');

    try {
      const txHash = await send();
      console.log('📡 Ledger tx hash:', txHash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (options?.onLocalAfterTx) await options.onLocalAfterTx();
      if (onAfterTx) await onAfterTx();

      setStatus('success');
      return { txHash, receipt };
    } catch (err: any) {
      console.error('❌ Ledger tx failed:', err);
      setErrorMessage(pickViemMessage(err));
      setStatus('error');
      return null;
    }
  };

  return {
    status,
    errorMessage,
    setErrorMessage,
    runTx,
  };
}
