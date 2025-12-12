// src/hooks/PositionPill/usePositionPill.ts
'use client';

import { useState } from 'react';
import {
  useAccount,
  useWriteContract,
  usePublicClient,
} from 'wagmi';
import { CONTRACTS, ABIS } from '../../config/contracts';
import { useLedgerTx } from '../../hooks/useLedgerTx';
import { addTokenToMetaMask } from '../../utils/addTokenToMetaMask';

type UsePositionPillArgs = {
  marketId: bigint;
  positionId: bigint;
  tokenAddress: `0x${string}`; // Back token (not used for Lay add)
  erc20Symbol: string;
  ticker: string;
  onAfterTx?: () => Promise<unknown> | void;
};

type TradeSide = 'back' | 'lay';

export function usePositionPill({
  marketId,
  positionId,
  tokenAddress,
  erc20Symbol,
  ticker,
  onAfterTx,
}: UsePositionPillArgs) {
  const { address } = useAccount();
  const { ledger, lmsr } = CONTRACTS.sepolia;
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const backTx = useLedgerTx({ onAfterTx });
  const layTx = useLedgerTx({ onAfterTx });

  const [size, setSize] = useState<string>('');
  const [side, setSide] = useState<TradeSide>('back');

  const [addedBack, setAddedBack] = useState(false);
  const [addedLay, setAddedLay] = useState(false);

  const isBusyBack = backTx.status === 'pending';
  const isBusyLay = layTx.status === 'pending';

  const executeTrade = async (isBack: boolean) => {
    const txHook = isBack ? backTx : layTx;

    if (!address) {
      txHook.setErrorMessage('Wallet not connected.');
      return;
    }

    const parsed = Number(size);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const USDC_DECIMALS = 6;
    const usdcIn = BigInt(Math.round(parsed * 10 ** USDC_DECIMALS));

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
    setSide('back');
    await executeTrade(true);
  };

  const handleLay = async () => {
    setSide('lay');
    await executeTrade(false);
  };

  const handleTrade = async () => {
    await executeTrade(side === 'back');
  };

  const handleAddToMetaMask = async () => {
    console.log('[usePositionPill] Add to MetaMask click', {
      marketId: marketId.toString(),
      positionId: positionId.toString(),
      side,
      backTokenProp: tokenAddress,
      erc20Symbol,
      ticker,
    });

    if (!publicClient) {
      console.log('[usePositionPill] publicClient not ready; cannot read Ledger.');
      return;
    }

    const isBack = side === 'back';

    try {
      // Fetch the correct ERC20 address for the current side
      const tokenOnChain = (await publicClient.readContract({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: isBack
          ? 'getBackPositionERC20'
          : 'getLayPositionERC20',
        args: [marketId, positionId],
      })) as `0x${string}`;

      // Fetch the exact symbol used by the clone ERC20
      const symbolOnChain = (await publicClient.readContract({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'erc20SymbolForSide',
        args: [marketId, positionId, isBack],
      })) as string;

      console.log('[usePositionPill] Calling addTokenToMetaMask', {
        side,
        isBack,
        address: tokenOnChain,
        symbolOnChain,
      });

      const ok = await addTokenToMetaMask({
        address: tokenOnChain,
        symbol: symbolOnChain,
        decimals: 6, // All mirrors use 6 decimals
      });

      if (ok) {
        if (isBack) {
          setAddedBack(true);
        } else {
          setAddedLay(true);
        }
      }
    } catch (err) {
      console.error(
        '[usePositionPill] Failed to fetch token metadata for MetaMask add:',
        err
      );
    }
  };

  return {
    size,
    setSize,
    side,
    setSide,
    isBusyBack,
    isBusyLay,
    handleBack,
    handleLay,
    handleTrade,
    handleAddToMetaMask,
    backStatus: backTx.status,
    layStatus: layTx.status,
    backErrorMessage: backTx.errorMessage,
    layErrorMessage: layTx.errorMessage,
    addedBack,
    addedLay,
  };
}
