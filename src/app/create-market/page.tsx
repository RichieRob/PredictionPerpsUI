// src/app/create-market/page.tsx
'use client';

import React from 'react';
import { CreateMarketView } from './CreateMarketView';
import { CONTRACTS } from '../../config/contracts';

export default function CreateMarketPage() {
  const oracleAddress = CONTRACTS.sepolia.mockOracle as `0x${string}`;
  return <CreateMarketView oracleAddress={oracleAddress} />;
}
