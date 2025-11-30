// src/hooks/useResettableStatus.ts
'use client';

import { useState, useEffect } from 'react';

export type BasicStatus = 'idle' | 'success' | 'error' | string;

export function useResettableStatus<T extends BasicStatus>(
  initial: T,
  resetDelayMs: number = 3000
) {
  const [status, setStatus] = useState<T>(initial);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const t = setTimeout(() => {
        setStatus(initial);
        setErrorMessage(null);
      }, resetDelayMs);
      return () => clearTimeout(t);
    }
  }, [status, initial, resetDelayMs]);

  return {
    status,
    setStatus,
    errorMessage,
    setErrorMessage,
  };
}
