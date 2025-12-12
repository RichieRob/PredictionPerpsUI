// src/hooks/PositionPill/usePositionPill.ts
'use client';

import { useState } from 'react';
import {
  useAccount,
  useWriteContract,
  usePublicClient,
  useReadContract,
} from 'wagmi';
import { CONTRACTS, ABIS } from '../../config/contracts';
import { useLedgerTx } from '../../hooks/useLedgerTx';
import { addTokenToMetaMask } from '../../utils/addTokenToMetaMask';

type UsePositionPillArgs = {
  marketId: bigint;
  positionId: bigint;
  tokenAddress: `0x${string}`;
  erc20Symbol: string;
  ticker: string;
  backBalance: number;
  layBalance: number;
  onAfterTx?: () => Promise<unknown> | void;
};

type TradeSide = 'back' | 'lay';

export function usePositionPill({
  marketId,
  positionId,
  tokenAddress,
  erc20Symbol,
  ticker,
  backBalance,
  layBalance,
  onAfterTx,
}: UsePositionPillArgs) {
  const { address } = useAccount();
  const { ledger } = CONTRACTS.sepolia;
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // ✅ per-market pricing MM
  const pricingMMQuery = useReadContract({
    address: ledger as `0x${string}`,
    abi: ABIS.ledger,
    functionName: 'getPricingMM',
    args: [marketId],
  });

  const pricingMM = pricingMMQuery.data as `0x${string}` | undefined;
  const hasPricingMM =
    !!pricingMM && pricingMM !== '0x0000000000000000000000000000000000000000';

  const backTx = useLedgerTx({ onAfterTx });
  const layTx = useLedgerTx({ onAfterTx });
  const liqTx = useLedgerTx({ onAfterTx });

  const [size, setSize] = useState<string>('');
  const [side, setSide] = useState<TradeSide>('back');

  const isBusyBack = backTx.status === 'pending';
  const isBusyLay = layTx.status === 'pending';
  const isBusyLiquidate = liqTx.status === 'pending';

  const executeTrade = async (isBack: boolean) => {
    const txHook = isBack ? backTx : layTx;

    if (!address) {
      txHook.setErrorMessage('Wallet not connected.');
      return;
    }
    if (!hasPricingMM) {
      txHook.setErrorMessage('No pricing market maker set for this market.');
      return;
    }

    const parsed = Number(size);
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    const USDC_DECIMALS = 6;
    const usdcIn = BigInt(Math.round(parsed * 10 ** USDC_DECIMALS));

    await txHook.runTx(
      async () => {
        const hash = await writeContractAsync({
          address: ledger as `0x${string}`,
          abi: ABIS.ledger,
          functionName: 'buyForppUSDC',
          args: [
            pricingMM as `0x${string}`, // ✅ per-market
            marketId,
            positionId,
            isBack,
            usdcIn,
            0n,
          ],
        });
        return hash;
      },
      { onLocalAfterTx: async () => setSize('') }
    );
  };

  const handleTrade = async () => executeTrade(side === 'back');

  const handleLiquidate = async () => {
    if (!address) {
      liqTx.setErrorMessage('Wallet not connected.');
      return;
    }
    if (!hasPricingMM) {
      liqTx.setErrorMessage('No pricing market maker set for this market.');
      return;
    }

    const exposure = Number(backBalance);
    if (!Number.isFinite(exposure) || exposure <= 0) {
      liqTx.setErrorMessage('No Back exposure to liquidate.');
      return;
    }

    const TOK_DECIMALS = 6;
    const t = BigInt(Math.round(exposure * 10 ** TOK_DECIMALS));
    const MAX_UINT256 = (1n << 256n) - 1n;

    await liqTx.runTx(async () => {
      return writeContractAsync({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'buyExactTokens',
        args: [
          pricingMM as `0x${string}`, // ✅ per-market
          marketId,
          positionId,
          false,
          t,
          MAX_UINT256,
        ],
      });
    });
  };

  const handleLiquidateLay = async () => {
    if (!address) {
      liqTx.setErrorMessage('Wallet not connected.');
      return;
    }
    if (!hasPricingMM) {
      liqTx.setErrorMessage('No pricing market maker set for this market.');
      return;
    }

    const exposure = Number(layBalance);
    if (!Number.isFinite(exposure) || exposure <= 0) {
      liqTx.setErrorMessage('No Lay exposure to liquidate.');
      return;
    }

    const TOK_DECIMALS = 6;
    const t = BigInt(Math.round(exposure * 10 ** TOK_DECIMALS));
    const MAX_UINT256 = (1n << 256n) - 1n;

    await liqTx.runTx(async () => {
      return writeContractAsync({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'buyExactTokens',
        args: [
          pricingMM as `0x${string}`, // ✅ per-market
          marketId,
          positionId,
          true,
          t,
          MAX_UINT256,
        ],
      });
    });
  };

  // (rest unchanged: add-to-metamask etc)

  return {
    size,
    setSize,
    side,
    setSide,
    isBusyBack,
    isBusyLay,
    isBusyLiquidate,
    handleTrade,
    handleLiquidate,
    handleLiquidateLay,
    handleAddToMetaMask: async () => { /* unchanged in your file */ },
    backStatus: backTx.status,
    layStatus: layTx.status,
    liqStatus: liqTx.status,
    backErrorMessage: backTx.errorMessage,
    layErrorMessage: layTx.errorMessage,
    liqErrorMessage: liqTx.errorMessage,
  };
}
