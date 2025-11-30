'use client';

import { useState, useEffect } from 'react';
import {
  useAccount,
  useWriteContract,
  usePublicClient,
  useWalletClient,
  useChainId,
} from 'wagmi';
import { parseUnits, hexToSignature, type Hex } from 'viem';
import { CONTRACTS, ABIS } from '../config/contracts';

const ERC20_PERMIT_ABI = [
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

type DepositPanelProps = {
  onAfterTx?: () => Promise<unknown> | void;
};

type Status = 'idle' | 'signing' | 'depositing' | 'success' | 'error';

export function DepositPanel({ onAfterTx }: DepositPanelProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const chainKey = 'sepolia' as const;
  const { ledger, usdc } = CONTRACTS[chainKey];

  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBusy = status === 'signing' || status === 'depositing';

  // 🔁 Auto-reset status after success/error so the button goes back to normal
  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const t = setTimeout(() => {
        setStatus('idle');
        setErrorMessage(null);
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const handleDeposit = async () => {
    if (!address) {
      setErrorMessage('Wallet not connected.');
      return;
    }
    if (!publicClient || !walletClient) {
      setErrorMessage('RPC or wallet client not ready.');
      return;
    }
    if (isBusy) return;

    setErrorMessage(null);
    setStatus('signing');

    try {
      const amount = parseUnits('100', 6); // 100 Mock USDC

      const nonce = (await publicClient.readContract({
        address: usdc as `0x${string}`,
        abi: ERC20_PERMIT_ABI,
        functionName: 'nonces',
        args: [address],
      })) as bigint;

      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + 60 * 10 // 10 minutes from now
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

      setStatus('depositing');

      const txHash = await writeContractAsync({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'deposit',
        args: [
          address, // to
          amount, // amount
          0n, // minUSDCDeposited
          1, // mode = 1 (EIP-2612)
          eipPermit,
          '0x', // permit2Calldata (unused)
        ],
        gas: 5_000_000n,
      });

      console.log('✅ deposit tx hash:', txHash);

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setStatus('success');

      if (onAfterTx) {
        await onAfterTx();
      }
    } catch (err: any) {
      console.error('❌ Deposit failed:', err);
      const short =
        err?.shortMessage ||
        err?.cause?.shortMessage ||
        err?.cause?.details ||
        err?.message ||
        'Transaction failed';
      setErrorMessage(short);
      setStatus('error');
    }
  };

  const buttonLabel = (() => {
    if (status === 'signing') return 'Sign permit…';
    if (status === 'depositing') return 'Depositing…';
    if (status === 'success') return 'Deposited ✔';
    if (status === 'error') return 'Try again';
    return 'Deposit 100 USDC (permit)';
  })();

  return (
    <section className="mb-4">
      <h2 className="h5">Deposit</h2>
      <p className="mb-2 text-muted">
        This uses an <code>permit</code> (EIP-2612): you sign once, then we send
        a single <code>deposit</code> transaction using that signature.
        <br />
        Slight adjustment to contracts needed to support Permit2.
      </p>

      {errorMessage && (
        <div className="alert alert-danger py-2">
          <strong>Deposit error:</strong> {errorMessage}
        </div>
      )}

      {status === 'success' && !errorMessage && (
        <div className="alert alert-success py-2">
          ✅ Deposit succeeded. Balances refreshed.
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary btn-sm d-inline-flex align-items-center"
        onClick={handleDeposit}
        disabled={isBusy}
      >
        {isBusy && (
          <span
            className="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          />
        )}
        {buttonLabel}
      </button>
    </section>
  );
}
  