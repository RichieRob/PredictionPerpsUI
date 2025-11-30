// src/components/TxStatusBanner.tsx
'use client';

type Props = {
  status: string;
  errorMessage: string | null;
  successMessage: string;
};

export function TxStatusBanner({
  status,
  errorMessage,
  successMessage,
}: Props) {
  if (status === 'success' && !errorMessage) {
    return <div className="alert alert-success py-2">{successMessage}</div>;
  }

  if (status === 'error' && errorMessage) {
    return (
      <div className="alert alert-danger py-2">
        <strong>Transaction error:</strong> {errorMessage}
      </div>
    );
  }

  return null;
}
