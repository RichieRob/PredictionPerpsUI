// src/components/WalletPanel.tsx
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

type WalletPanelProps = {
  usdcBalance: number;
  ppBalance: number;
  onAfterTx?: () => Promise<unknown> | void;
};

export function WalletPanel({ usdcBalance, ppBalance, onAfterTx }: WalletPanelProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const chainKey = 'sepolia' as const;
  const { ledger, usdc } = CONTRACTS[chainKey];

  const {
    status,
    errorMessage,
    setErrorMessage,
    runTx,
  } = useLedgerTx({ onAfterTx });

  // 👉 default blank
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');

  const isBusy = status === 'pending';

  // --- Wallet → Ledger (deposit using permit) ---

  const handleDeposit = async () => {
    if (!address) {
      setErrorMessage('Wallet not connected.');
      return;
    }
    if (!publicClient || !walletClient) {
      setErrorMessage('RPC or wallet client not ready.');
      return;
    }

    const parsed = Number(depositAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErrorMessage('Enter a valid deposit amount.');
      return;
    }

    try {
      setErrorMessage(null);

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

      await runTx(
        () =>
          writeContractAsync({
            address: ledger as `0x${string}`,
            abi: ABIS.ledger,
            functionName: 'deposit',
            args: [
              address,
              amount,
              0n,
              1,
              eipPermit,
              '0x',
            ],
            gas: 5_000_000n,
          }),
        {
          // 👉 clear input after successful deposit
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
      setErrorMessage(short);
    }
  };

  // --- Ledger → Wallet (withdraw) ---

  const handleWithdraw = async () => {
    if (!address) {
      setErrorMessage('Wallet not connected.');
      return;
    }

    const parsed = Number(withdrawAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setErrorMessage('Enter a valid withdraw amount.');
      return;
    }

    try {
      setErrorMessage(null);
      const amount = parseUnits(withdrawAmount, 6);

      await runTx(
        () =>
          writeContractAsync({
            address: ledger as `0x${string}`,
            abi: ABIS.ledger,
            functionName: 'withdraw',
            args: [amount, address],
            gas: 3_000_000n,
          }),
        {
          // 👉 clear input after successful withdraw
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
      setErrorMessage(short);
    }
  };

  const buttonLabelDeposit = (() => {
    if (status === 'pending') return 'Sign & Wrap…';
    if (status === 'success') return 'Wrapped ✔';
    if (status === 'error') return 'Try again';
    return 'Wrap';
  })();

  const buttonLabelWithdraw = (() => {
    if (status === 'pending') return 'Unwrapping...';
    if (status === 'success') return 'Unrapped ✔';
    if (status === 'error') return 'Try again';
    return 'Unwrap';
  })();

  return (
    <section className="mb-4">
      <h2 className="h5 mb-1">Wallet</h2>
      <p className="mb-2 text-muted"></p>

      <div className="border rounded p-3">
        <div className="d-flex flex-column flex-md-row justify-content-between mb-3">
          <div className="mb-2 mb-md-0">
            <strong>USDC:</strong> {usdcBalance.toFixed(2)}
          </div>
          <div>
            <strong>ppUSDC:</strong> {ppBalance.toFixed(2)}
          </div>
        </div>

        <TxStatusBanner
          status={status}
          errorMessage={errorMessage}
          successMessage="✅ Transaction succeeded. Balances refreshed."
        />

        <div className="row g-3 mt-1">
          {/* USDC → ppUSDC */}
          <div className="col-12 col-md-6">
            <div className="mb-1 fw-semibold">USDC → ppUSDC</div>
            <p className="text-muted small mb-2">
              <code>Wrap</code>
            </p>
            <div className="d-flex align-items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
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
                {buttonLabelDeposit}
              </button>
            </div>
          </div>

          {/* Ledger → Wallet */}
          <div className="col-12 col-md-6">
            <div className="mb-1 fw-semibold">ppUSDC → USDC</div>
            <p className="text-muted small mb-2">
              <code>Unwrap</code>
            </p>
            <div className="d-flex align-items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="form-control form-control-sm"
                style={{ width: '120px' }}
                placeholder="Amount (USDC)"
              />
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center"
                onClick={handleWithdraw}
                disabled={isBusy}
              >
                {isBusy && (
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  />
                )}
                {buttonLabelWithdraw}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
