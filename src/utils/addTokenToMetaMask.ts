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
          symbol,
          decimals,
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

// NEW: Batch version (concurrent requests for unified prompt)
export async function addTokensToMetaMask(tokens: AddTokenArgs[]): Promise<boolean[]> {
  if (typeof window === 'undefined') {
    console.log('[addTokensToMetaMask] window undefined (SSR)');
    return tokens.map(() => false);
  }

  const ethereum = (window as any).ethereum;
  if (!ethereum?.request) {
    console.log('[addTokensToMetaMask] No ethereum provider on window.');
    return tokens.map(() => false);
  }

  if (tokens.length === 0) {
    console.log('[addTokensToMetaMask] No tokens provided.');
    return [];
  }

  try {
    console.log('[addTokensToMetaMask] Preparing batch watchAsset requests:', tokens);

    // Fire concurrent requests (MetaMask may batch UI prompts)
    const promises = tokens.map(async (token) => {
      try {
        return await ethereum.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20',
            options: {
              address: token.address,
              symbol: token.symbol,
              decimals: token.decimals,
            },
          },
        });
      } catch (err) {
        console.error('[addTokensToMetaMask] Error adding token:', token.address, err);
        return false;
      }
    });

    const results = await Promise.all(promises);
    const successes = results.map((res) => !!res);

    console.log('[addTokensToMetaMask] Batch watchAsset results:', successes);
    return successes;
  } catch (err: any) {
    const msg =
      err?.message ||
      err?.code ||
      (Object.keys(err || {}).length === 0
        ? 'Unknown / empty error (likely user cancelled)'
        : JSON.stringify(err));

    console.log('[addTokensToMetaMask] Batch watchAsset error:', msg);
    return tokens.map(() => false);
  }
}