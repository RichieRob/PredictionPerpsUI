'use client';

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { sepolia } from 'viem/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

if (!projectId) {
  // you can remove this once you set the env var
  console.warn('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not set');
}

export const wagmiConfig = getDefaultConfig({
  appName: 'Prediction Perps',
  projectId,          // WalletConnect / Reown project id
  chains: [sepolia],
  ssr: true,
  transports: {
    [sepolia.id]: http(),
  },
});
