// src/hooks/PositionPill/usePositionPill.ts
'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../../config/contracts';
import { useLedgerTx } from '../../hooks/useLedgerTx';
import { addTokenToMetaMask } from '../../utils/addTokenToMetaMask';

type UsePositionPillArgs = {
  marketId: bigint;
  positionId: bigint;
  tokenAddress: `0x${string}`;
  erc20Symbol: string;
  ticker: string;
  onAfterTx?: () => Promise<unknown> | void;
};

export function usePositionPill({ marketId, positionId, tokenAddress, erc20Symbol, ticker, onAfterTx }: UsePositionPillArgs) {
  const { address } = useAccount();
  const { ledger, lmsr } = CONTRACTS.sepolia;
  const { writeContractAsync } = useWriteContract();

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
        console.log('[usePositionPill] about to send trade tx', {
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
    
        console.log('[usePositionPill] tx sent, hash:', hash);
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

  const handleAddToMetaMask = async () => {
    console.log('[usePositionPill] Add to MetaMask click', {
      positionId: positionId.toString(),
      tokenAddress,
      erc20Symbol,
      ticker,
    });

    const symbolToUse = erc20Symbol || ticker || `POS${positionId.toString()}`;
    const decimalsToUse = 6;

    console.log('[usePositionPill] Calling addTokenToMetaMask', {
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

  return {
    size,
    setSize,
    isBusyBack,
    isBusyLay,
    handleBack,
    handleLay,
    handleAddToMetaMask,
    backStatus: backTx.status,
    layStatus: layTx.status,
    backErrorMessage: backTx.errorMessage,
    layErrorMessage: layTx.errorMessage,
  };
}