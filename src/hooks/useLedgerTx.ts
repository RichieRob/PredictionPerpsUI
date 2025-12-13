// src/hooks/useLedgerTx.ts
'use client';

import { usePublicClient } from 'wagmi';
import { useResettableStatus } from './useResettableStatus';

export type TxStatus = 'idle' | 'pending' | 'success' | 'error';

type UseLedgerTxArgs = {
  onAfterTx?: () => Promise<unknown> | void;
};

export type RunTxOptions = {
  label?: string;
  onLocalAfterTx?: () => Promise<unknown> | void;
};

function walkErr(err: any) {
  const chain: any[] = [];
  let cur = err;
  const seen = new Set<any>();
  while (cur && !seen.has(cur) && chain.length < 8) {
    seen.add(cur);
    chain.push(cur);
    cur = cur?.cause || cur?.error || cur?.data?.cause;
  }
  return chain;
}

function isGasCapError(msg: string) {
  return (
    /gas limit too high/i.test(msg) ||
    /exceeds block gas limit/i.test(msg) ||
    /intrinsic gas too low/i.test(msg)
  );
}

function pickViemMessage(err: any): string {
  const meta =
    err?.cause?.metaMessages ||
    err?.metaMessages ||
    err?.cause?.cause?.metaMessages ||
    null;

  if (Array.isArray(meta) && meta.length) return meta.join('\n');

  const reason =
    err?.cause?.reason ||
    err?.cause?.cause?.reason ||
    err?.reason ||
    null;

  if (typeof reason === 'string' && reason.trim()) return reason;

  return (
    err?.shortMessage ||
    err?.cause?.shortMessage ||
    err?.cause?.details ||
    err?.details ||
    err?.message ||
    'Transaction failed'
  );
}

function formatUserFacingError(err: any, label?: string) {
  const main = pickViemMessage(err);
  const prefix = label ? `[${label}] ` : '';

  if (isGasCapError(main)) {
    return (
      `${prefix}${main}\n` +
      `RPC/node refused the tx request (gasLimit too high), not a Solidity revert reason.`
    );
  }

  return `${prefix}${main}`;
}

export function useLedgerTx({ onAfterTx }: UseLedgerTxArgs) {
  const publicClient = usePublicClient();

  const { status, setStatus, errorMessage, setErrorMessage } =
    useResettableStatus<TxStatus>('idle');

  // Keep the raw error around (optional; useful for debugging)
  const { status: rawError, setStatus: setRawError } =
    useResettableStatus<any>(null);

  const runTx = async (
    send: () => Promise<`0x${string}`>,
    options?: RunTxOptions
  ) => {
    if (!publicClient) {
      setErrorMessage('RPC client not ready.');
      setRawError(null);
      return null;
    }

    setErrorMessage(null);
    setRawError(null);
    setStatus('pending');

    const label = options?.label;

    try {
      const txHash = await send();
      console.log(`📡 tx broadcast${label ? ` [${label}]` : ''}:`, txHash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

      if (options?.onLocalAfterTx) await options.onLocalAfterTx();
      if (onAfterTx) await onAfterTx();

      setStatus('success');
      return { txHash, receipt };
    } catch (err: any) {
      console.error(`❌ tx failed${label ? ` [${label}]` : ''}:`, err);

      try {
        const chain = walkErr(err).map((e) => ({
          name: e?.name,
          shortMessage: e?.shortMessage,
          message: e?.message,
          reason: e?.reason,
          details: e?.details,
          code: e?.code,
        }));
        console.log('↯ error chain:', chain);
      } catch {}

      setRawError(err);
      setErrorMessage(formatUserFacingError(err, label));
      setStatus('error');
      return null;
    }
  };

  return {
    status,
    errorMessage,
    rawError,
    setErrorMessage,
    runTx,
  };
}
