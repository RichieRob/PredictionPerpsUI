// src/utils/addTokenToMetaMask.ts
'use client';

type AddTokenArgs = {
  address: `0x${string}`;
  symbol: string;      // MUST match ERC20.symbol() exactly
  decimals: number;    // MUST match ERC20.decimals() exactly
};

export async function addTokenToMetaMask({
  address,
  symbol,
  decimals,
}: AddTokenArgs): Promise<boolean> {
  if (typeof window === 'undefined') {
    console.log('[addTokenToMetaMask] window undefined (SSR)');
    return false;
  }

  const ethereum = (window as any).ethereum;
  if (!ethereum?.request) {
    console.log('[addTokenToMetaMask] No ethereum provider on window.');
    return false;
  }

  try {
    console.log('[addTokenToMetaMask] Requesting watchAsset:', {
      address,
      symbol,
      decimals,
    });

    const wasAdded = await ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address,
          symbol,   // 👈 send the exact contract symbol
          decimals, // 👈 must equal token.decimals()
        },
      },
    });

    console.log('[addTokenToMetaMask] wallet_watchAsset result:', wasAdded);

    if (!wasAdded) {
      console.log(
        '[addTokenToMetaMask] Token not added (user cancelled, or wallet ignored request).',
      );
    }

    return !!wasAdded;
  } catch (err: any) {
    const msg =
      err?.message ||
      err?.code ||
      (Object.keys(err || {}).length === 0
        ? 'Unknown / empty error (likely user cancelled)'
        : JSON.stringify(err));

    console.log('[addTokenToMetaMask] wallet_watchAsset error:', msg);
    return false;
  }
}
