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
import { PriceBar } from './PriceBar';

// Minimal ERC20 ABI for balanceOf
const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

type PositionPillProps = {
  marketId: bigint;
  positionId: bigint;
  /** 0–1, or null if unknown */
  price: number | null;
  onAfterTx?: () => Promise<unknown> | void;
  /** Called by this pill after a trade, so MarketRow refreshes all prices */
  onMarketPriceUpdate?: () => Promise<unknown> | void;
};

export function PositionPill({
  marketId,
  positionId,
  price,
  onAfterTx,
  onMarketPriceUpdate,
}: PositionPillProps) {
  const { address } = useAccount();
  const { ledger } = CONTRACTS.sepolia;
  const { writeContractAsync } = useWriteContract();

  // --- Name + ticker from Ledger ---
  const { data: posMeta } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getPositionDetails',
    args: [marketId, positionId],
  });

  const [name, ticker] = (posMeta || []) as [string, string];

  // --- Position ERC20 address ---
  const { data: tokenAddressRaw } = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getPositionERC20',
    args: [marketId, positionId],
  });

  const tokenAddress =
    (tokenAddressRaw as `0x${string}` | undefined) || undefined;

  // --- Balance of this position token for the connected wallet ---
  const {
    data: balanceRaw,
    refetch: refetchBalance,
  } = useReadContract({
    address: tokenAddress as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address && tokenAddress ? [address] : undefined,
    query: {
      enabled: !!address && !!tokenAddress,
    },
    watch: true,
  });

  let balanceLabel = '0';
  if (balanceRaw !== undefined) {
    const bal = Number(balanceRaw) / 1e6; // PositionERC20.decimals() = 6
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
            0n,   // minTokensOut
          ],
        }),
      {
        // Local follow-up:
        //  - refresh this position balance
        //  - ask MarketRow to refetch ALL prices in this market
        onLocalAfterTx: async () => {
          await Promise.allSettled([
            refetchBalance(),
            onMarketPriceUpdate?.(),
          ]);
        },
      }
    );
  };

  const handleAddToMetaMask = async () => {
    if (!tokenAddress) return;
    const symbol = ticker || `POS${positionId.toString()}`;
    await addTokenToMetaMask({
      address: tokenAddress,
      symbol,   // must match contract symbol now
      decimals: 6,
    });
  };

  const buttonLabel = (() => {
    if (status === 'pending') return 'Buying…';
    if (status === 'success') return 'Bought ✔';
    if (status === 'error') return 'Try again';
    return 'Buy';
  })();

  // --- Display format for price ---
  const clamped =
    price != null ? Math.max(0, Math.min(price, 1)) : null;

  const priceLabel =
    clamped != null ? `$${clamped.toFixed(3)}` : '–';

  return (
    <div className="border rounded p-2 bg-light">
      {/* Header row: name + price + balance */}
      <div className="d-flex justify-content-between align-items-center mb-1">
        <div>
          <strong>{ticker || positionId.toString()}</strong>{' '}
          <span className="text-muted">{name}</span>
        </div>
        <div className="text-end">
          <div className="fw-semibold text-primary">
            {priceLabel}
          </div>
          <div className="small text-success">
            Bal: {balanceLabel}
          </div>
        </div>
      </div>

      {/* Probability bar */}
      <div className="mb-2">
        <PriceBar price={clamped} />
      </div>

      <TxStatusBanner
        status={status}
        errorMessage={errorMessage}
        successMessage="✅ Buy succeeded. Balances refreshed."
      />

      {/* Controls row */}
      <div className="d-flex align-items-center gap-2 mt-1">
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
          Add
        </button>
      </div>
    </div>
  );
}
