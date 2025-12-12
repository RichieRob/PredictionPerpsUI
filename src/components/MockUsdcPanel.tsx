// src/components/MockUsdcPanel.tsx
'use client';

import { useAccount, useWriteContract } from 'wagmi';
import { CONTRACTS } from '../config/contracts';

export function MockUsdcPanel({ onAfterMint }: { onAfterMint?: () => void }) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { usdc } = CONTRACTS.sepolia;

  if (!address) return null;

  const handleMint = async () => {
    try {
      const amount = BigInt(1_000_000 * 1e6); // 1,000,000 USDC (6 decimals)

      const hash = await writeContractAsync({
        address: usdc as `0x${string}`,
        abi: [
          {
            name: 'mint',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [],
          },
        ],
        functionName: 'mint',
        args: [address, amount],
      });

      console.log('Mint tx:', hash);

      if (onAfterMint) await onAfterMint();
    } catch (err) {
      console.error('Mint USDC failed:', err);
    }
  };

  return (
    <div className="mb-4 p-3 border rounded bg-light">
      <h5 className="mb-2">Mock USDC</h5>
      <button className="btn btn-sm btn-success" onClick={handleMint}>
        Mint 1,000,000 Mock USDC
      </button>
    </div>
  );
}
