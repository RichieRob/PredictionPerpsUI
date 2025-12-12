// src/app/create-market/useCreateMarket.ts
'use client';

import { useMemo, useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { decodeEventLog } from 'viem';
import { ABIS, CONTRACTS } from '../../config/contracts';
import { useLedgerTx } from '../../hooks/useLedgerTx';
import { isValidTicker, sanitizeTicker } from './tickers';

type PositionDraft = { name: string; ticker: string };

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
  const positionsOk = positions.every((p) => p.name.trim().length > 0 && isValidTicker(p.ticker, 4));

  const canCreate =
    !!address &&
    marketName.trim().length > 0 &&
    marketTickerOk &&
    positionsOk &&
    status !== 'pending';

  const createMarket = async (oracleAddress: `0x${string}`) => {
    if (!address) return;

    setCreatedMarketId(null);

    // IMPORTANT: this flow does NOT set DMM / ISC at creation time.
    const dmm = ZERO_ADDR;
    const iscAmount = 0n;

    const doesResolve = true;
    const oracleParams = '0x' as `0x${string}`;
    const feeBps = 0;
    const marketCreator = address;
    const feeWhitelistAccounts: `0x${string}`[] = [];
    const hasWhitelist = false;

    // ---- 1) createMarket ----
    const res1 = await runTx(() =>
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
    if (!res1) return;

    let marketId: bigint | null = null;
    for (const log of res1.receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: ABIS.ledger,
          data: log.data,
          topics: log.topics as any,
        });
        if (decoded.eventName === 'MarketCreated') {
          marketId = (decoded.args as any).marketId as bigint;
          break;
        }
      } catch {}
    }
    if (marketId === null) return;

    setCreatedMarketId(marketId);

    // ---- 2) createPositions ----
    const posMetas = positions.map((p) => ({ name: p.name, ticker: p.ticker }));

    const res2 = await runTx(() =>
      writeContractAsync({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'createPositions',
        args: [marketId, posMetas],
      })
    );
    if (!res2) return;

    // ---- 3) lockMarketPositions (so OTHER disappears immediately) ----
    const res3 = await runTx(() =>
      writeContractAsync({
        address: ledger as `0x${string}`,
        abi: ABIS.ledger,
        functionName: 'lockMarketPositions',
        args: [marketId],
      })
    );
    if (!res3) return;
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

    positionsCount,
    setPositionsCount,
    positions,
    updatePos,
    onPositionTickerChange,

    canCreate,
    createMarket,
  };
}
