// src/app/create-market/useCreateMarket.ts
'use client';

import { useMemo, useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { decodeEventLog } from 'viem';
import { ABIS, CONTRACTS } from '../../config/contracts';
import { useLedgerTx } from '../../hooks/useLedgerTx';
import { isValidTicker, sanitizeTicker } from './tickers';

type PositionDraft = { name: string; ticker: string };
type AmmKind = 'LMSR' | 'VF' | 'NormalizedLinear';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const;

export function useCreateMarket() {
  const { address } = useAccount();
  const chainKey = 'sepolia' as const;
  const { ledger } = CONTRACTS[chainKey];

  const { writeContractAsync } = useWriteContract();
  const { status, errorMessage, runTx } = useLedgerTx({});

  const [createdMarketId, setCreatedMarketId] = useState<bigint | null>(null);

  const [marketName, setMarketName] = useState('');
  const [marketTicker, setMarketTicker] = useState('');

  const [amm, setAmm] = useState<AmmKind>('LMSR');
  const [ammSeedPpUSDC, setAmmSeedPpUSDC] = useState('');

  const [positionsCount, setPositionsCount] = useState(2);
  const [positions, setPositions] = useState<PositionDraft[]>([
    { name: '', ticker: '' },
    { name: '', ticker: '' },
  ]);

  useMemo(() => {
    setPositions((prev) => {
      const next = prev.slice(0, positionsCount);
      while (next.length < positionsCount) next.push({ name: '', ticker: '' });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsCount]);

  const updatePos = (i: number, patch: Partial<PositionDraft>) => {
    setPositions((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const onMarketTickerChange = (raw: string) => setMarketTicker(sanitizeTicker(raw, 4));
  const onPositionTickerChange = (i: number, raw: string) =>
    updatePos(i, { ticker: sanitizeTicker(raw, 4) });

  const marketTickerOk = isValidTicker(marketTicker, 4);
  const positionsOk = positions.every(
    (p) => p.name.trim().length > 0 && isValidTicker(p.ticker, 4)
  );

  const canCreate =
    !!address &&
    marketName.trim().length > 0 &&
    marketTickerOk &&
    positionsOk &&
    status !== 'pending';

  const createMarket = async (oracleAddress: `0x${string}`) => {
    if (!address) return;

    const dmm = ZERO_ADDR;
    const iscAmount = 0n;
    const doesResolve = true;

    const oracleParams = '0x' as `0x${string}`;
    const feeBps = 0;
    const marketCreator = address;
    const feeWhitelistAccounts: `0x${string}`[] = [];
    const hasWhitelist = false;

    const res = await runTx(() =>
      writeContractAsync({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'createMarket',
        args: [
          marketName,
          marketTicker,
          dmm,
          iscAmount,
          doesResolve,
          oracleAddress,
          oracleParams,
          feeBps,
          marketCreator as `0x${string}`,
          feeWhitelistAccounts,
          hasWhitelist,
        ],
      })
    );

    if (!res) return;

    for (const log of res.receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: ABIS.ledger,
          data: log.data,
          topics: log.topics as any,
        });
        if (decoded.eventName === 'MarketCreated') {
          const mid = (decoded.args as any).marketId as bigint;
          setCreatedMarketId(mid);
          return;
        }
      } catch {}
    }
  };

  return {
    status,
    errorMessage,
    createdMarketId,

    marketName,
    setMarketName,
    marketTicker,
    onMarketTickerChange,
    marketTickerOk,

    amm,
    setAmm,
    ammSeedPpUSDC,
    setAmmSeedPpUSDC,

    positionsCount,
    setPositionsCount,
    positions,
    updatePos,
    onPositionTickerChange,

    canCreate,
    createMarket,
  };
}
