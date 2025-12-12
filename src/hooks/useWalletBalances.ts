// src/hooks/useWalletBalances.ts
'use client';

import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS, ABIS } from '../config/contracts';

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export function useWalletBalances() {
  const { address } = useAccount();
  const chainKey = 'sepolia' as const;
  const { ppUSDC, usdc } = CONTRACTS[chainKey];

  // ppUSDC balance
  const {
    data: ppBalanceRaw,
    refetch: refetchPp,
  } = useReadContract({
    address: ppUSDC as `0x${string}`,
    abi: ABIS.ppUSDC,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // USDC balance
  const {
    data: usdcBalanceRaw,
    refetch: refetchUsdc,
  } = useReadContract({
    address: usdc as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  const ppBalance =
    ppBalanceRaw !== undefined ? Number(ppBalanceRaw) / 1e6 : 0;
  const usdcBalance =
    usdcBalanceRaw !== undefined ? Number(usdcBalanceRaw) / 1e6 : 0;

  return {
    address,
    ppBalance,
    usdcBalance,
    refetchPp,
    refetchUsdc,
  };
}
