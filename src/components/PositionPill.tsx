
// src/components/PositionPill.tsx
'use client';

import React, { useState } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
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
  tokenAddress: `0x${string}`;
  balance: number;
  price: number | null;
  erc20Symbol: string;
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
  onAfterTx,
}: PositionPillProps) {
  const { address } = useAccount();
  const { ledger, lmsr } = CONTRACTS.sepolia;
  const { writeContractAsync } = useWriteContract();

  // NEW: Separate hooks for back and lay
  const backTx = useLedgerTx({ onAfterTx });
  const layTx = useLedgerTx({ onAfterTx });

  const [size, setSize] = useState<string>('');

  const isBusyBack = backTx.status === 'pending';
  const isBusyLay = layTx.status === 'pending';

  const executeTrade = async (isBack: boolean) => {
    if (!address) {
      const txHook = isBack ? backTx : layTx;
      txHook.setErrorMessage('Wallet not connected.');
      return;
    }

    const parsed = Number(size);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const USDC_DECIMALS = 6;
    const usdcIn = BigInt(Math.round(parsed * 10 ** USDC_DECIMALS));

    const txHook = isBack ? backTx : layTx;

    await txHook.runTx(
      async () => {
        console.log('[PositionPill] about to send trade tx', {
          marketId: marketId.toString(),
          positionId: positionId.toString(),
          isBack,
          usdcIn: usdcIn.toString(),
        });
    
        const hash = await writeContractAsync({
          address: ledger as `0x${string}`,
          abi: ABIS.ledger,
          functionName: 'buyForppUSDC',
          args: [
            lmsr as `0x${string}`,
            marketId,
            positionId,
            isBack,
            usdcIn,
            0n,
          ],
        });
    
        console.log('[PositionPill] tx sent, hash:', hash);
        return hash;
      },
      {
        onLocalAfterTx: async () => {
          setSize('');
        },
      }
    );
  };

  const handleBack = async () => {
    await executeTrade(true);
  };

  const handleLay = async () => {
    await executeTrade(false);
  };

  // Fetch decimals on demand
  const [isFetchingDecimals, setIsFetchingDecimals] = useState(false);

  const { data: decimalsRaw } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: isFetchingDecimals,
    },
  });

  const fetchedDecimals = decimalsRaw !== undefined ? Number(decimalsRaw) : 6;

  const handleAddToMetaMask = async () => {
    setIsFetchingDecimals(true);

    console.log('[PositionPill] Add to MetaMask click', {
      positionId: positionId.toString(),
      tokenAddress,
      erc20Symbol,
      ticker,
    });

    // Wait briefly for fetch if triggered
    await new Promise(resolve => setTimeout(resolve, 1000));

    const symbolToUse = erc20Symbol || ticker || `POS${positionId.toString()}`;
    const decimalsToUse = fetchedDecimals;

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

    setIsFetchingDecimals(false);
  };

  const clamped = price != null ? Math.max(0, Math.min(price, 1)) : null;
  const priceLabel = clamped != null ? `$${clamped.toFixed(6)}` : '–';
  const balanceLabel = Number.isFinite(balance) ? balance.toFixed(0) : '0';

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
          isBusyBack={isBusyBack}
          isBusyLay={isBusyLay}
          onBack={handleBack}
          onLay={handleLay}
          backStatus={backTx.status}
          layStatus={layTx.status}
          backErrorMessage={backTx.errorMessage}
          layErrorMessage={layTx.errorMessage}
        />
      </td>

      <td className="align-middle text-end">
        <AddToMetaMaskButton
          onAdd={handleAddToMetaMask}
          disabled={isFetchingDecimals}
        />
      </td>
    </tr>
  );
}

type TxSectionProps = {
  size: string;
  setSize: (v: string) => void;
  isBusyBack: boolean;
  isBusyLay: boolean;
  onBack: () => void;
  onLay: () => void;
  backStatus: 'idle' | 'pending' | 'success' | 'error';
  layStatus: 'idle' | 'pending' | 'success' | 'error';
  backErrorMessage: string | null;
  layErrorMessage: string | null;
};

function TransactionSection({
  size,
  setSize,
  isBusyBack,
  isBusyLay,
  onBack,
  onLay,
  backStatus,
  layStatus,
  backErrorMessage,
  layErrorMessage,
}: TxSectionProps) {
  return (
    <div>
      {/* NEW: Separate banners */}
      <TxStatusBanner
        status={backStatus}
        errorMessage={backErrorMessage}
        successMessage="✅ Trade succeeded. Balances refreshed."
      />
      <TxStatusBanner
        status={layStatus}
        errorMessage={layErrorMessage}
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
          disabled={isBusyBack}
        >
          {isBusyBack && (
            <span
              className="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            />
          )}
          {backStatus === 'pending' ? 'Backing...' :
           backStatus === 'success' ? 'Backed ✔' :
           backStatus === 'error' ? 'Try again' : 'Back'}
        </button>

        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={onLay}
          disabled={isBusyLay}
        >
          {isBusyLay && (
            <span
              className="spinner-border spinner-border-sm me-1"
              role="status"
              aria-hidden="true"
            />
          )}
          {layStatus === 'pending' ? 'Laying...' :
           layStatus === 'success' ? 'Laid ✔' :
           layStatus === 'error' ? 'Try again' : 'Lay'}
        </button>
      </div>
    </div>
  );
}

type AddButtonProps = {
  onAdd: () => void;
  disabled: boolean;
};

function AddToMetaMaskButton({ onAdd, disabled }: AddButtonProps) {
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      onClick={onAdd}
      disabled={disabled}
    >
      Add
    </button>
  );
}

// NEW: Standard ERC20 ABI for symbol/decimals (add to file or import from contracts if not there)
const ERC20_ABI = [
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const;
