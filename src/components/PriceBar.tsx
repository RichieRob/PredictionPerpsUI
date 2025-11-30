// src/components/PriceBar.tsx
'use client';

import type { CSSProperties } from 'react';

type PriceBarProps = {
  /** 0–1 probability, or null if unknown */
  price: number | null;
  /** Optional pixel width */
  width?: number;
  /** Optional pixel height */
  height?: number;
};

export function PriceBar({
  price,
  width = 140,
  height = 8,
}: PriceBarProps) {
  const clamped =
    price != null ? Math.max(0, Math.min(price, 1)) : null;
  const percent = clamped != null ? clamped * 100 : 0;

  const outerStyle: CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    borderRadius: '4px',
    backgroundColor: '#e9ecef',
    overflow: 'hidden',
  };

  const innerStyle: CSSProperties = {
    height: '100%',
    borderRadius: '4px',
    backgroundColor: '#0d6efd', // Bootstrap primary
    transition: 'width 0.35s ease-out',
    width: `${percent}%`,
    opacity: clamped == null ? 0.2 : 1,
  };

  return (
    <div style={outerStyle}>
      <div style={innerStyle} />
    </div>
  );
}
