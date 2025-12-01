// src/components/PositionPill.tsx
'use client';

import React, { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../config/contracts';
import { useLedgerTx } from '../hooks/useLedgerTx';
import { TxStatusBanner } from './TxStatusBanner';
import { addTokenToMetaMask } from '../utils/addTokenToMetaMask';
import { PriceBar } from './PriceBar';

type PositionPillProps = {
  marketId: bigint;
  positionId: bigint;
  name: string;
  ticker: string;
  tokenAddress: `0x${string}` | null;
  balance: number;
  price: number | null;
  erc20Symbol: string | null;
  erc20Decimals: number | null;
  onAfterTx?: () => Promise<unknown> | void;
};

export function PositionPill({
  marketId,
  positionId,
  name,
  ticker,
  tokenAddress,
  balance,
  price,
  erc20Symbol,
  erc20Decimals,
  onAfterTx,
}: PositionPillProps) {
  const { address } = useAccount();
  const { ledger, lmsr } = CONTRACTS.sepolia;
  const { writeContractAsync } = useWriteContract();

  const {
    status,
    errorMessage,
    runTx,
    setErrorMessage,
  } = useLedgerTx({ onAfterTx });

  // 👉 default blank
  const [size, setSize] = useState<string>('');
  const [lastAction, setLastAction] = useState<'back' | 'lay' | null>(null);
  const isBusy = status === 'pending';

  const executeTrade = async (isBack: boolean, action: 'back' | 'lay') => {
    if (!address) {
      setErrorMessage('Wallet not connected.');
      return;
    }

    const parsed = Number(size);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const USDC_DECIMALS = 6;
    const usdcIn = BigInt(Math.round(parsed * 10 ** USDC_DECIMALS));

    setLastAction(action);

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
            isBack,   // 👈 true = back, false = lay
            usdcIn,
            0n,
          ],
        }),
      {
        // 👉 clear the input locally after tx success
        onLocalAfterTx: async () => {
          setSize('');
        },
      }
    );
  };

  const handleBack = async () => {
    await executeTrade(true, 'back');
  };

  const handleLay = async () => {
    await executeTrade(false, 'lay');
  };

  const handleAddToMetaMask = async () => {
    console.log('[PositionPill] Add to MetaMask click', {
      positionId: positionId.toString(),
      tokenAddress,
      erc20Symbol,
      erc20Decimals,
      ticker,
    });

    if (!tokenAddress) return;

    const symbolToUse = erc20Symbol || ticker || `POS${positionId.toString()}`;
    const decimalsToUse =
      erc20Decimals != null ? erc20Decimals : 6;

    console.log('[PositionPill] Calling addTokenToMetaMask', {
      address: tokenAddress,
      symbolToUse,
      decimalsToUse,
    });

    await addTokenToMetaMask({
      address: tokenAddress,
      symbol: symbolToUse,
      decimals: decimalsToUse,
    });
  };

  const backButtonLabel = (() => {
    if (status === 'pending' && lastAction === 'back') return 'Backing...';
    if (status === 'success' && lastAction === 'back') return 'Backed ✔';
    if (status === 'error' && lastAction === 'back') return 'Try again';
    return 'Back';
  })();

  const layButtonLabel = (() => {
    if (status === 'pending' && lastAction === 'lay') return 'Laying...';
    if (status === 'success' && lastAction === 'lay') return 'Laid ✔';
    if (status === 'error' && lastAction === 'lay') return 'Try again';
    return 'Lay';
  })();

  const balanceLabel = Number.isFinite(balance)
    ? balance.toFixed(0)
    : '0';

  const clamped =
    price != null ? Math.max(0, Math.min(price, 1)) : null;
  const priceLabel =
    clamped != null ? `$${clamped.toFixed(3)}` : '–';

  return (
    <tr>
      <td>
        <div>
          <strong>{ticker || positionId.toString()}</strong>{' '}
          <span className="text-muted">{name}</span>
        </div>
      </td>

      <td className="text-end align-middle">
        {balanceLabel}
      </td>

      <td className="align-middle">
        <div className="d-flex flex-column">
          <div className="fw-semibold text-primary text-end mb-1">
            {priceLabel}
          </div>
          <div className="d-flex justify-content-end">
            <PriceBar price={clamped} />
          </div>
        </div>
      </td>

      <td className="align-middle text-end">
        <TransactionSection
          size={size}
          setSize={setSize}
          isBusy={isBusy}
          backButtonLabel={backButtonLabel}
          layButtonLabel={layButtonLabel}
          onBack={handleBack}
          onLay={handleLay}
          status={status}
          errorMessage={errorMessage}
        />
      </td>

      <td className="align-middle text-end">
        <AddToMetaMaskButton
          tokenAddress={tokenAddress}
          onAdd={handleAddToMetaMask}
        />
      </td>
    </tr>
  );
}

type TxSectionProps = {
  size: string;
  setSize: (v: string) => void;
  isBusy: boolean;
  backButtonLabel: string;
  layButtonLabel: string;
  onBack: () => void;
  onLay: () => void;
  status: 'idle' | 'pending' | 'success' | 'error';
  errorMessage: string | null;
};

function TransactionSection({
  size,
  setSize,
  isBusy,
  backButtonLabel,
  layButtonLabel,
  onBack,
  onLay,
  status,
  errorMessage,
}: TxSectionProps) {
  return (
    <div>
      <TxStatusBanner
        status={status}
        errorMessage={errorMessage}
        successMessage="✅ Trade succeeded. Balances refreshed."
      />

      <div className="d-flex justify-content-end align-items-center gap-2 mt-1">
        <input
          type="number"
          min="0"
          step="0.01"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="form-control form-control-sm"
          style={{ width: '100px' }}
          placeholder="ppUSDC"
        />

        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={onBack}
          disabled={isBusy}
        >
          {isBusy && (
            <span
              className="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            />
          )}
          {backButtonLabel}
        </button>

        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={onLay}
          disabled={isBusy}
        >
          {isBusy && (
            <span
              className="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            />
          )}
          {layButtonLabel}
        </button>
      </div>
    </div>
  );
}

type AddButtonProps = {
  tokenAddress: `0x${string}` | null;
  onAdd: () => void;
};

function AddToMetaMaskButton({ tokenAddress, onAdd }: AddButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      onClick={onAdd}
      disabled={!tokenAddress}
    >
      Add
    </button>
  );
}
