// src/components/Markets/ExposureCell.tsx
'use client';

import { fmt } from '../../utils/formatNumber';

type ExposureCellProps = {
  amount: number;
  variant: 'back' | 'lay';
};

export function ExposureCell({ amount, variant }: ExposureCellProps) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return <span className="text-muted">$0</span>;
  }

  const formatted = fmt(amount, 0);

  if (variant === 'back') {
    // Back exposure is *positive* (good): green +X
    return <span className="text-success">+${formatted}</span>;
  }

  // Lay exposure is *liability* (bad): red -X
  return <span className="text-danger">-${formatted}</span>;
}
