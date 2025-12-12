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
  backBalance: number;          // Back exposure (tokens)
  layBalance: number;           // Lay exposure (tokens)
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
  const { ledger, lmsr } = CONTRACTS.sepolia;
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const backTx = useLedgerTx({ onAfterTx });
  const layTx = useLedgerTx({ onAfterTx });
  const liqTx = useLedgerTx({ onAfterTx }); // shared for both liquidation flows

  const [size, setSize] = useState<string>('');
  const [side, setSide] = useState<TradeSide>('back');

  const [addedBack, setAddedBack] = useState(false);
  const [addedLay, setAddedLay] = useState(false);

  const isBusyBack = backTx.status === 'pending';
  const isBusyLay = layTx.status === 'pending';
  const isBusyLiquidate = liqTx.status === 'pending';

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

  // Liquidate Back exposure: buy Lay tokens equal to Back balance
  const handleLiquidate = async () => {
    if (!address) {
      liqTx.setErrorMessage('Wallet not connected.');
      return;
    }

    const exposure = Number(backBalance);
    if (!Number.isFinite(exposure) || exposure <= 0) {
      liqTx.setErrorMessage('No Back exposure to liquidate.');
      return;
    }

    const TOK_DECIMALS = 6;
    const t = BigInt(Math.round(exposure * 10 ** TOK_DECIMALS));

    // Very loose maxUSDCIn – “just close me” button
    const MAX_UINT256 = (1n << 256n) - 1n;

    await liqTx.runTx(async () => {
      console.log('[usePositionPill] liquidation BACK→LAY tx', {
        marketId: marketId.toString(),
        positionId: positionId.toString(),
        backExposureTokens: exposure,
        t: t.toString(),
      });

      const hash = await writeContractAsync({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'buyExactTokens',
        args: [
          lmsr as `0x${string}`,
          marketId,
          positionId,
          false,      // isBack = false => buy LAY
          t,          // Lay tokens = Back exposure
          MAX_UINT256,
        ],
      });

      console.log('[usePositionPill] liquidation BACK→LAY tx sent, hash:', hash);
      return hash;
    });
  };

  // NEW: Liquidate Lay exposure: buy Back tokens equal to Lay balance
  const handleLiquidateLay = async () => {
    if (!address) {
      liqTx.setErrorMessage('Wallet not connected.');
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
      console.log('[usePositionPill] liquidation LAY→BACK tx', {
        marketId: marketId.toString(),
        positionId: positionId.toString(),
        layExposureTokens: exposure,
        t: t.toString(),
      });

      const hash = await writeContractAsync({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'buyExactTokens',
        args: [
          lmsr as `0x${string}`,
          marketId,
          positionId,
          true,       // isBack = true => buy BACK
          t,          // Back tokens = Lay exposure
          MAX_UINT256,
        ],
      });

      console.log('[usePositionPill] liquidation LAY→BACK tx sent, hash:', hash);
      return hash;
    });
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
    isBusyLiquidate,
    handleBack,
    handleLay,
    handleTrade,
    handleLiquidate,      // Back → Lay
    handleLiquidateLay,   // Lay → Back
    handleAddToMetaMask,
    backStatus: backTx.status,
    layStatus: layTx.status,
    liqStatus: liqTx.status,
    backErrorMessage: backTx.errorMessage,
    layErrorMessage: layTx.errorMessage,
    liqErrorMessage: liqTx.errorMessage,
    addedBack,
    addedLay,
  };
}
