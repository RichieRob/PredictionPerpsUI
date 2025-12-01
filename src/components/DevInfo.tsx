'use client';

type DevInfoProps = {
  ledger: string;
  ppUSDC: string;
  usdc: string;
};

export function DevInfo({ ledger, ppUSDC, usdc }: DevInfoProps) {
  return (
    <section className="mt-4">
      <h2 className="h6 mb-2">Dev info</h2>
      <div className="card card-body py-2">
        <div className="mb-1">
          <strong>Ledger:</strong>{' '}
          <code className="text-break">{ledger}</code>
        </div>
        <div className="mb-1">
          <strong>ppUSDC:</strong>{' '}
          <code className="text-break">{ppUSDC}</code>
        </div>
        <div className="mb-0">
          <strong>USDC:</strong>{' '}
          <code className="text-break">{usdc}</code>
        </div>
      </div>
    </section>
  );
}
