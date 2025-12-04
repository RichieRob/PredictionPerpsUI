// src/components/WalletPanel/WalletPanel.tsx
'use client';

import { TxStatusBanner } from './TxStatusBanner';
import { useWalletPanel } from '../hooks/WalletPanel/useWalletPanel';

type WalletPanelProps = {
  usdcBalance: number;
  ppBalance: number;
  onAfterTx?: () => Promise<unknown> | void;
};

export function WalletPanel({ usdcBalance, ppBalance, onAfterTx }: WalletPanelProps) {
  const {
    depositAmount,
    setDepositAmount,
    withdrawAmount,
    setWithdrawAmount,
    isBusyDeposit,
    isBusyWithdraw,
    handleDeposit,
    handleWithdraw,
    depositStatus,
    withdrawStatus,
    depositErrorMessage,
    withdrawErrorMessage,
  } = useWalletPanel({ onAfterTx });

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
          status={depositStatus}
          errorMessage={depositErrorMessage}
          successMessage="✅ Transaction succeeded. Balances refreshed."
        />
        <TxStatusBanner
          status={withdrawStatus}
          errorMessage={withdrawErrorMessage}
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
                disabled={isBusyDeposit}
              >
                {isBusyDeposit && (
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  />
                )}
                {depositStatus === 'pending' ? 'Sign & Wrap…' :
                 depositStatus === 'success' ? 'Wrapped ✔' :
                 depositStatus === 'error' ? 'Try again' : 'Wrap'}
              </button>
            </div>
          </div>

          {/* ppUSDC → USDC */}
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
                disabled={isBusyWithdraw}
              >
                {isBusyWithdraw && (
                  <span
                    className="spinner-border spinner-border-sm me-2"
                    role="status"
                    aria-hidden="true"
                  />
                )}
                {withdrawStatus === 'pending' ? 'Unwrapping...' :
                 withdrawStatus === 'success' ? 'Unwrapped ✔' :
                 withdrawStatus === 'error' ? 'Try again' : 'Unwrap'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}