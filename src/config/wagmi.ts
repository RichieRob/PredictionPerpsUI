'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { sepolia } from 'viem/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';
const infuraId  = process.env.NEXT_PUBLIC_INFURA_ID;

if (!projectId) console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not set');
if (!infuraId)  console.warn('NEXT_PUBLIC_INFURA_ID not set');

export const wagmiConfig = getDefaultConfig({
  appName: 'Prediction Perps',
  projectId,
  chains: [sepolia],
  ssr: true,
  transports: {
    [sepolia.id]: http(`https://sepolia.infura.io/v3/${infuraId}`),
  },
});
