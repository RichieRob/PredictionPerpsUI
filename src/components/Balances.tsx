'use client';

type BalancesProps = {
  usdcBalance: number;
  ppBalance: number;
};

export function Balances({ usdcBalance, ppBalance }: BalancesProps) {
  return (
    <section className="mb-4">
      <h2 className="h5">Balances</h2>
      <p className="mb-1">
        <strong>Mock USDC:</strong> {usdcBalance.toFixed(2)}
      </p>
      <p className="mb-0">
        <strong>ppUSDC:</strong> {ppBalance.toFixed(2)}
      </p>
    </section>
  );
}
