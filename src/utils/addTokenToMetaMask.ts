// src/utils/addTokenToMetaMask.ts
'use client';

type AddTokenArgs = {
  address: `0x${string}`;
  symbol: string;   // SHOULD match ERC20.symbol()
  decimals: number; // SHOULD match ERC20.decimals()
};

function getEthereumProvider(): any | null {
  if (typeof window === 'undefined') {
    console.log('[addTokenToMetaMask] window undefined (SSR)');
    return null;
  }

  const eth = (window as any).ethereum;
  if (!eth?.request) {
    console.log('[addTokenToMetaMask] No ethereum provider on window.');
    return null;
  }

  return eth;
}

function normaliseError(err: unknown): string {
  const e = err as any;
  const msg =
    e?.message ||
    e?.code ||
    (e && Object.keys(e).length > 0
      ? JSON.stringify(e)
      : 'Unknown / empty error (likely user cancelled)');
  return String(msg);
}

export async function addTokenToMetaMask({
  address,
  symbol,
  decimals,
}: AddTokenArgs): Promise<boolean> {
  const ethereum = getEthereumProvider();
  if (!ethereum) return false;

  try {
    console.log('[addTokenToMetaMask] Requesting wallet_watchAsset:', {
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
  } catch (err) {
    const msg = normaliseError(err);

    // -32601 is "method not found" on some wallets
    console.log('[addTokenToMetaMask] wallet_watchAsset error:', msg);
    return false;
  }
}

// Batch version (concurrent requests)
export async function addTokensToMetaMask(
  tokens: AddTokenArgs[],
): Promise<boolean[]> {
  const ethereum = getEthereumProvider();
  if (!ethereum) return tokens.map(() => false);

  if (tokens.length === 0) {
    console.log('[addTokensToMetaMask] No tokens provided.');
    return [];
  }

  try {
    console.log(
      '[addTokensToMetaMask] Preparing batch wallet_watchAsset requests:',
      tokens,
    );

    const promises = tokens.map(async (token) => {
      try {
        const res = await ethereum.request({
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

        return !!res;
      } catch (err) {
        console.error(
          '[addTokensToMetaMask] Error adding token:',
          token.address,
          normaliseError(err),
        );
        return false;
      }
    });

    const results = await Promise.all(promises);
    console.log('[addTokensToMetaMask] Batch wallet_watchAsset results:', results);
    return results;
  } catch (err) {
    const msg = normaliseError(err);
    console.log('[addTokensToMetaMask] Batch wallet_watchAsset error:', msg);
    return tokens.map(() => false);
  }
}
