// src/components/DepositPanel.tsx
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
import { CONTRACTS, ABIS } from '../config/contracts';
import { useLedgerTx } from '../hooks/useLedgerTx';
import { TxStatusBanner } from './TxStatusBanner';

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

export function DepositPanel({ onAfterTx }: DepositPanelProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const chainKey = 'sepolia' as const;
  const { ledger, usdc } = CONTRACTS[chainKey];

  // Unified tx state (pending / success / error + banner text)
  const {
    status,
    errorMessage,
    setErrorMessage,
    runTx,
  } = useLedgerTx({ onAfterTx });

  // Amount input (in USDC)
  const [amountInput, setAmountInput] = useState<string>('100');

  const isBusy = status === 'pending';

  const handleDeposit = async () => {
    if (!address) {
      setErrorMessage('Wallet not connected.');
      return;
    }
    if (!publicClient || !walletClient) {
      setErrorMessage('RPC or wallet client not ready.');
      return;
    }

    const parsed = Number(amountInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErrorMessage('Enter a valid amount.');
      return;
    }

    try {
      setErrorMessage(null);

      // 1) Build the amount (6 decimals)
      const amount = parseUnits(amountInput, 6); // e.g. "100" -> 100e6

      // 2) Read nonce for permit
      const nonce = (await publicClient.readContract({
        address: usdc as `0x${string}`,
        abi: ERC20_PERMIT_ABI,
        functionName: 'nonces',
        args: [address],
      })) as bigint;

      const deadline = BigInt(
        Math.floor(Date.now() / 1000) + 60 * 10 // 10 minutes
      );

      // 3) EIP-2612 domain + types + message
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

      // 4) Have the wallet sign the permit
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

      // 5) Send the on-chain deposit tx via the unified tx helper
      await runTx(() =>
        writeContractAsync({
          address: ledger as `0x${string}`,
          abi: ABIS.ledger,
          functionName: 'deposit',
          args: [
            address, // to
            amount,  // amount
            0n,      // minUSDCDeposited
            1,       // mode = 1 (EIP-2612)
            eipPermit,
            '0x',    // permit2Calldata (unused)
          ],
          gas: 5_000_000n,
        })
      );
    } catch (err: any) {
      console.error('❌ Deposit failed:', err);
      const short =
        err?.shortMessage ||
        err?.cause?.shortMessage ||
        err?.cause?.details ||
        err?.message ||
        'Transaction failed';
      setErrorMessage(short);
    }
  };

  const buttonLabel = (() => {
    if (status === 'pending') return 'Sign & deposit…';
    if (status === 'success') return 'Deposited ✔';
    if (status === 'error') return 'Try again';
    return 'Deposit';
  })();

  return (
    <section className="mb-4">
      <h2 className="h5">Deposit</h2>
      <p className="mb-2 text-muted">
        Uses an <code>permit</code> (EIP-2612): you sign once, then we send a
        single <code>deposit</code> transaction.
      </p>

      <TxStatusBanner
        status={status}
        errorMessage={errorMessage}
        successMessage="✅ Deposit succeeded. Balances refreshed."
      />

      <div className="d-flex align-items-center gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          className="form-control form-control-sm"
          style={{ width: '120px' }}
          placeholder="Amount (USDC)"
        />
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
      </div>
    </section>
  );
}
