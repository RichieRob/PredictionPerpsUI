// src/components/PositionPill.tsx
'use client';

import React, { useState } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from 'wagmi';
import { CONTRACTS, ABIS } from '../config/contracts';
import { useLedgerTx } from '../hooks/useLedgerTx';
import { TxStatusBanner } from './TxStatusBanner';
import { addTokenToMetaMask } from '../utils/addTokenToMetaMask';

// Minimal ERC20 ABI for balanceOf + symbol
const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

type PositionPillProps = {
  marketId: bigint;
  positionId: bigint;
  priceLabel: string;
  onAfterTx?: () => Promise<unknown> | void;
  onMarketPriceUpdate?: () => Promise<unknown> | void;
};

export function PositionPill({
  marketId,
  positionId,
  priceLabel,
  onAfterTx,
  onMarketPriceUpdate,
}: PositionPillProps) {
  const { address } = useAccount();
  const { ledger } = CONTRACTS.sepolia;
  const { writeContractAsync } = useWriteContract();

  // --- Name + *position* ticker from Ledger ---
  const { data: posMeta } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getPositionDetails',
    args: [marketId, positionId],
  });

  const [name, positionTicker] = (posMeta || []) as [string, string];

  // --- Position ERC20 address from Ledger ---
  const { data: tokenAddressRaw } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getPositionERC20',
    args: [marketId, positionId],
  });

  const tokenAddress =
    (tokenAddressRaw as `0x${string}` | undefined) || undefined;

  // --- Balance + ERC20.symbol() from the actual Position token ---
  const {
    data: erc20Data,
    refetch: refetchErc20Data,
  } = useReadContract({
    address: tokenAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    // NOTE: we only call balanceOf via abi, symbol is separate below.
    // We'll read symbol via a second call so wagmi doesn't get confused.
    args: address && tokenAddress ? [address] : undefined,
    query: {
      enabled: !!address && !!tokenAddress,
    },
  });

  const { data: tokenSymbolRaw } = useReadContract({
    address: tokenAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'symbol',
    args: [],
    query: {
      enabled: !!tokenAddress,
    },
  });

  const tokenSymbol = tokenSymbolRaw as string | undefined;

  let balanceLabel = '0';
  if (erc20Data !== undefined) {
    const bal = Number(erc20Data) / 1e6; // PositionERC20.decimals() = 6
    balanceLabel = bal.toFixed(0);
  }

  // --- Shared tx hook with unified UX ---
  const {
    status,
    errorMessage,
    runTx,
    setErrorMessage,
  } = useLedgerTx({ onAfterTx });

  const isBusy = status === 'pending';
  const [size, setSize] = useState<string>('1'); // 1 USDC default

  // --- MetaMask "add token" feedback ---
  const [addStatus, setAddStatus] = useState<'idle' | 'added' | 'failed'>(
    'idle',
  );

  const handleBuy = async () => {
    if (!address) {
      setErrorMessage('Wallet not connected.');
      return;
    }

    const parsed = Number(size);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const USDC_DECIMALS = 6;
    const usdcIn = BigInt(Math.round(parsed * 10 ** USDC_DECIMALS));

    const { lmsr } = CONTRACTS.sepolia;

    await runTx(
      () =>
        writeContractAsync({
          address: ledger as `0x${string}`,
          abi: ABIS.ledger,
          functionName: 'buyForppUSDC',
          args: [
            lmsr as `0x${string}`,
            marketId,
            positionId,
            true, // isBack
            usdcIn,
            0n, // minTokensOut
          ],
        }),
      {
        // 🔁 Local follow-up after tx:
        //  - refresh this position balance
        //  - refresh symbol (just in case, though it shouldn't change)
        //  - ask MarketRow to refresh ALL prices (this position + siblings + OTHER)
        onLocalAfterTx: async () => {
          await Promise.allSettled([
            refetchErc20Data(),
            onMarketPriceUpdate?.(),
          ]);
        },
      },
    );
  };

  const handleAddToMetaMask = async () => {
    if (!tokenAddress) {
      console.log('[PositionPill] No tokenAddress for this position yet.');
      setAddStatus('failed');
      return;
    }

    if (!tokenSymbol) {
      console.log(
        '[PositionPill] No tokenSymbol yet – ERC20.symbol() not loaded.',
      );
      setAddStatus('failed');
      return;
    }

    const ok = await addTokenToMetaMask({
      address: tokenAddress,
      symbol: tokenSymbol, // 👈 EXACT contract symbol, e.g. "POS1-TEST"
      decimals: 6,
    });

    setAddStatus(ok ? 'added' : 'failed');
  };

  const buttonLabel = (() => {
    if (status === 'pending') return 'Buying…';
    if (status === 'success') return 'Bought ✔';
    if (status === 'error') return 'Try again';
    return 'Buy';
  })();

  return (
    <span className="badge bg-light text-dark border p-2">
      <div className="d-flex flex-column gap-1">
        <div>
          <strong>{positionTicker || positionId.toString()}</strong>{' '}
          <span className="text-muted">{name}</span>{' '}
          <span className="ms-1 text-primary fw-semibold">
            {priceLabel}
          </span>{' '}
          <span className="ms-1 text-success">
            Bal: {balanceLabel}
          </span>
        </div>

        <TxStatusBanner
          status={status}
          errorMessage={errorMessage}
          successMessage="✅ Buy succeeded. Balances refreshed."
        />

        <div className="d-flex align-items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="form-control form-control-sm"
            style={{ width: '80px' }}
            placeholder="USDC"
          />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={handleBuy}
          disabled={isBusy}
        >
          {isBusy && (
            <span
              className="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            />
          )}
          {buttonLabel}
        </button>

          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={handleAddToMetaMask}
            disabled={!tokenAddress}
          >
            Add to MetaMask
          </button>

          {addStatus === 'added' && (
            <small className="text-success">Added ✓</small>
          )}
          {addStatus === 'failed' && (
            <small className="text-muted">
              Couldn&apos;t add (maybe cancelled)
            </small>
          )}
        </div>
      </div>
    </span>
  );
}
