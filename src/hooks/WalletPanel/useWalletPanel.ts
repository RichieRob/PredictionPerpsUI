// src/hooks/WalletPanel/useWalletPanel.ts
'use client';

import { useState } from 'react';
import {
  useAccount,
  useWriteContract,
  usePublicClient,
  useWalletClient,
  useChainId,
} from 'wagmi';
import { parseUnits, hexToSignature, type Hex } from 'viem';
import { CONTRACTS, ABIS } from '../../config/contracts';
import { useLedgerTx } from '../../hooks/useLedgerTx';
import { addTokenToMetaMask } from '../../utils/addTokenToMetaMask';

const ERC20_PERMIT_ABI = [
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const ERC20_SYMBOL_DECIMALS_ABI = [
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

type UseWalletPanelArgs = {
  onAfterTx?: () => Promise<unknown> | void;
};

export function useWalletPanel({ onAfterTx }: UseWalletPanelArgs) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const chainKey = 'sepolia' as const;
  const { ledger, usdc, ppUSDC } = CONTRACTS[chainKey];

  const depositTx = useLedgerTx({ onAfterTx });
  const withdrawTx = useLedgerTx({ onAfterTx });

  const [depositAmount, setDepositAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');

  const [usdcAdded, setUsdcAdded] = useState(false);
  const [ppAdded, setPpAdded] = useState(false);

  const isBusyDeposit = depositTx.status === 'pending';
  const isBusyWithdraw = withdrawTx.status === 'pending';

  const handleDeposit = async () => {
    if (!address) {
      depositTx.setErrorMessage('Wallet not connected.');
      return;
    }
    if (!publicClient || !walletClient) {
      depositTx.setErrorMessage('RPC or wallet client not ready.');
      return;
    }

    const parsed = Number(depositAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      depositTx.setErrorMessage('Enter a valid deposit amount.');
      return;
    }

    try {
      depositTx.setErrorMessage(null);

      const amount = parseUnits(depositAmount, 6);

      const nonce = (await publicClient.readContract({
        address: usdc as `0x${string}`,
        abi: ERC20_PERMIT_ABI,
        functionName: 'nonces',
        args: [address],
      })) as bigint;

      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + 60 * 10
      );

      const domain = {
        name: 'Mock USDC',
        version: '1',
        chainId,
        verifyingContract: usdc as `0x${string}`,
      };

      const types = {
        Permit: [
          { name: 'owner', type: 'address' },
          { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      } as const;

      const message = {
        owner: address,
        spender: ledger as `0x${string}`,
        value: amount,
        nonce,
        deadline,
      };

      const signature = await walletClient.signTypedData({
        account: address,
        domain,
        types,
        primaryType: 'Permit',
        message,
      });

      const { r, s, v } = hexToSignature(signature as Hex);

      const eipPermit = {
        value: amount,
        deadline,
        v: Number(v),
        r,
        s,
      };

      await depositTx.runTx(
        () =>
          writeContractAsync({
            address: ledger as `0x${string}`,
            abi: ABIS.ledger,
            functionName: 'deposit',
            args: [address, amount, 0n, 1, eipPermit],
            gas: 5_000_000n,
          }),
        {
          onLocalAfterTx: async () => {
            setDepositAmount('');
          },
        }
      );
    } catch (err: any) {
      console.error('❌ Deposit failed:', err);
      const short =
        err?.shortMessage ||
        err?.cause?.shortMessage ||
        err?.cause?.details ||
        err?.message ||
        'Transaction failed';
      depositTx.setErrorMessage(short);
    }
  };

  const handleWithdraw = async () => {
    if (!address) {
      withdrawTx.setErrorMessage('Wallet not connected.');
      return;
    }

    const parsed = Number(withdrawAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      withdrawTx.setErrorMessage('Enter a valid withdraw amount.');
      return;
    }

    try {
      withdrawTx.setErrorMessage(null);
      const amount = parseUnits(withdrawAmount, 6);

      await withdrawTx.runTx(
        () =>
          writeContractAsync({
            address: ledger as `0x${string}`,
            abi: ABIS.ledger,
            functionName: 'withdraw',
            args: [amount, address],
            gas: 3_000_000n,
          }),
        {
          onLocalAfterTx: async () => {
            setWithdrawAmount('');
          },
        }
      );
    } catch (err: any) {
      console.error('❌ Withdraw failed:', err);
      const short =
        err?.shortMessage ||
        err?.cause?.shortMessage ||
        err?.cause?.details ||
        err?.message ||
        'Transaction failed';
      withdrawTx.setErrorMessage(short);
    }
  };

  const handleAddUSDCToMetaMask = async () => {
    if (!publicClient) return;

    try {
      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: usdc as `0x${string}`,
          abi: ERC20_SYMBOL_DECIMALS_ABI,
          functionName: 'symbol',
        }) as Promise<string>,
        publicClient.readContract({
          address: usdc as `0x${string}`,
          abi: ERC20_SYMBOL_DECIMALS_ABI,
          functionName: 'decimals',
        }) as Promise<number>,
      ]);

      const ok = await addTokenToMetaMask({
        address: usdc as `0x${string}`,
        symbol,
        decimals,
      });

      if (ok) setUsdcAdded(true);
    } catch (err) {
      console.error('[useWalletPanel] Failed to add USDC to MetaMask:', err);
    }
  };

  const handleAddPpUSDCToMetaMask = async () => {
    if (!publicClient) return;

    try {
      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address: ppUSDC as `0x${string}`,
          abi: ERC20_SYMBOL_DECIMALS_ABI,
          functionName: 'symbol',
        }) as Promise<string>,
        publicClient.readContract({
          address: ppUSDC as `0x${string}`,
          abi: ERC20_SYMBOL_DECIMALS_ABI,
          functionName: 'decimals',
        }) as Promise<number>,
      ]);

      const ok = await addTokenToMetaMask({
        address: ppUSDC as `0x${string}`,
        symbol,
        decimals,
      });

      if (ok) setPpAdded(true);
    } catch (err) {
      console.error('[useWalletPanel] Failed to add ppUSDC to MetaMask:', err);
    }
  };

  return {
    depositAmount,
    setDepositAmount,
    withdrawAmount,
    setWithdrawAmount,
    isBusyDeposit,
    isBusyWithdraw,
    handleDeposit,
    handleWithdraw,
    depositStatus: depositTx.status,
    withdrawStatus: withdrawTx.status,
    depositErrorMessage: depositTx.errorMessage,
    withdrawErrorMessage: withdrawTx.errorMessage,
    handleAddUSDCToMetaMask,
    handleAddPpUSDCToMetaMask,
    usdcAdded,
    ppAdded,
  };
}
