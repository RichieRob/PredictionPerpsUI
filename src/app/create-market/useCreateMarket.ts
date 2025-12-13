// src/app/create-market/useCreateMarket.ts
'use client';

import { useEffect, useState } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { decodeEventLog } from 'viem';
import { ABIS, CONTRACTS } from '../../config/contracts';
import { useLedgerTx } from '../../hooks/useLedgerTx';
import { isValidTicker, sanitizeTicker } from './tickers';

type PositionDraft = { name: string; ticker: string; weight: string };

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as const;
const WAD = 10n ** 18n;

type StepKey =
  | 'cloneMM'
  | 'createMarket'
  | 'createPositions'
  | 'initLmsr'
  | 'setPricingMM'
  | 'lockPositions';

export type Step = {
  key: StepKey;
  title: string;
  status: 'idle' | 'pending' | 'success' | 'error';
  txHash?: `0x${string}`;
  error?: string;
};

function makeSteps(): Step[] {
  return [
    { key: 'cloneMM', title: 'Clone LMSR market maker (UNBOUND)', status: 'idle' },
    {
      key: 'createMarket',
      title: 'Create market (doesResolve=true, dmm=0, isc=0)',
      status: 'idle',
    },
    { key: 'createPositions', title: 'Create positions', status: 'idle' },
    { key: 'initLmsr', title: 'Init LMSR for that market (bind + seed)', status: 'idle' },
    { key: 'setPricingMM', title: 'Set pricing market maker = LMSR', status: 'idle' },
    { key: 'lockPositions', title: 'Lock positions (optional)', status: 'idle' },
  ];
}

const USDC_SCALE = 10n ** 6n;

function parseUSDC6(input: string): bigint | null {
  // accepts "12", "12.3", "12.34" etc. Pads/truncs to 6 decimals.
  const s = input.trim();
  if (!s) return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return null;

  const [whole, fracRaw = ''] = s.split('.');
  const frac = (fracRaw + '000000').slice(0, 6);

  try {
    const w = BigInt(whole);
    const f = BigInt(frac);
    return w * USDC_SCALE + f;
  } catch {
    return null;
  }
}

function parsePositiveInt(input: string): bigint | null {
  const s = input.trim();
  if (!/^\d+$/.test(s)) return null;
  try {
    const n = BigInt(s);
    return n > 0n ? n : null;
  } catch {
    return null;
  }
}

export function useCreateMarket() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const chainKey = 'sepolia' as const;
  const { ledger, marketMakerHub } = CONTRACTS[chainKey];

  const { writeContractAsync } = useWriteContract();
  const { status, errorMessage, runTx } = useLedgerTx({});

  const [createdMarketId, setCreatedMarketId] = useState<bigint | null>(null);
  const [createdMM, setCreatedMM] = useState<`0x${string}` | null>(null);

  const [marketName, setMarketName] = useState('');
  const [marketTicker, setMarketTicker] = useState('');

  // ✅ new: liability (USDC) input as human string
  const [liabilityUSDCInput, setLiabilityUSDCInput] = useState<string>('100');

  const [positionsCount, setPositionsCount] = useState(2);
  const [positions, setPositions] = useState<PositionDraft[]>([
    { name: '', ticker: '', weight: '1' },
    { name: '', ticker: '', weight: '1' },
  ]);

  const [steps, setSteps] = useState<Step[]>(makeSteps());
  const resetSteps = () => setSteps(makeSteps());
  const mark = (key: StepKey, patch: Partial<Step>) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  useEffect(() => {
    setPositions((prev) => {
      const next = prev.slice(0, positionsCount);
      while (next.length < positionsCount) {
        next.push({ name: '', ticker: '', weight: '1' });
      }
      return next;
    });
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

  // ✅ weight: digits only
  const onPositionWeightChange = (i: number, raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, '');
    updatePos(i, { weight: cleaned });
  };

  const marketTickerOk = isValidTicker(marketTicker, 4);

  const weightsOk = positions.every((p) => parsePositiveInt(p.weight) !== null);
  const positionsOk = positions.every(
    (p) => p.name.trim().length > 0 && isValidTicker(p.ticker, 4)
  ) && weightsOk;

  const liabilityOk = parseUSDC6(liabilityUSDCInput) !== null;

  const canCreate =
    !!address &&
    marketName.trim().length > 0 &&
    marketTickerOk &&
    positionsOk &&
    liabilityOk &&
    status !== 'pending';

  const createMarket = async (oracleAddress: `0x${string}`) => {
    if (!address || !publicClient) return;

    setCreatedMarketId(null);
    setCreatedMM(null);
    resetSteps();

    // ============================================================
    // 0) Clone LMSR (UNBOUND)
    // ============================================================
    mark('cloneMM', { status: 'pending', error: undefined, txHash: undefined });

    const hubWeightWad = 0n;
    const res0 = await runTx(
      () =>
        writeContractAsync({
          address: marketMakerHub as `0x${string}`,
          abi: ABIS.marketMakerHub,
          functionName: 'createLMSRUnbound',
          args: [hubWeightWad],
        }),
      { label: 'Clone LMSR' }
    );

    if (!res0) {
      mark('cloneMM', { status: 'error', error: errorMessage || 'Failed' });
      return;
    }
    mark('cloneMM', { status: 'success', txHash: res0.txHash });

    let mm: `0x${string}` | null = null;
    for (const log of res0.receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: ABIS.marketMakerHub,
          data: log.data,
          topics: log.topics as any,
        });
        if (decoded.eventName === 'MarketMakerCreated') {
          mm = (decoded.args as any).mm as `0x${string}`;
          break;
        }
      } catch {}
    }

    if (!mm) {
      mark('cloneMM', { status: 'error', error: 'MarketMakerCreated(mm) not found in logs' });
      return;
    }
    setCreatedMM(mm);

    // ============================================================
    // 1) createMarket (doesResolve=true, dmm=0, isc=0)
    // ============================================================
    mark('createMarket', { status: 'pending', error: undefined, txHash: undefined });

    const dmm = ZERO_ADDR;
    const iscAmount = 0n;

    const doesResolve = true;
    const oracle = oracleAddress;
    const oracleParams = '0x' as `0x${string}`;

    const feeBps = 0;
    const marketCreator = address;
    const feeWhitelistAccounts: `0x${string}`[] = [];
    const hasWhitelist = false;

    const res1 = await runTx(
      () =>
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
            oracle,
            oracleParams,
            feeBps,
            marketCreator as `0x${string}`,
            feeWhitelistAccounts,
            hasWhitelist,
          ],
        }),
      { label: 'Create Market' }
    );

    if (!res1) {
      mark('createMarket', { status: 'error', error: errorMessage || 'Failed' });
      return;
    }
    mark('createMarket', { status: 'success', txHash: res1.txHash });

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
    if (marketId === null) {
      mark('createMarket', { status: 'error', error: 'MarketCreated not found in logs' });
      return;
    }
    setCreatedMarketId(marketId);

    // ============================================================
    // 2) createPositions
    // ============================================================
    mark('createPositions', { status: 'pending', error: undefined, txHash: undefined });

    const posMetas = positions.map((p) => ({ name: p.name, ticker: p.ticker }));

    const res2 = await runTx(
      () =>
        writeContractAsync({
          address: ledger as `0x${string}`,
          abi: ABIS.ledger,
          functionName: 'createPositions',
          args: [marketId, posMetas],
        }),
      { label: 'Create Positions' }
    );

    if (!res2) {
      mark('createPositions', { status: 'error', error: errorMessage || 'Failed' });
      return;
    }
    mark('createPositions', { status: 'success', txHash: res2.txHash });

    // ============================================================
    // 3) initMarket on LMSR clone (binds marketId)
    // ============================================================
    mark('initLmsr', { status: 'pending', error: undefined, txHash: undefined });

    const positionIds = (await publicClient.readContract({
      address: ledger as `0x${string}`,
      abi: ABIS.ledger,
      functionName: 'getMarketPositions',
      args: [marketId],
    })) as bigint[];

    // ✅ weights: caller-scale; LMSRInitLib will normalize to sum=1e18 (with reserve)
    const initialPositions = positionIds.map((id, idx) => {
      const w = parsePositiveInt(positions[idx]?.weight ?? '1') ?? 1n;
      return { positionId: id, r: w * WAD };
    });

    // ✅ liability: user enters USDC, we pass raw 1e6
    const liabilityUSDC = parseUSDC6(liabilityUSDCInput);
    if (liabilityUSDC === null) {
      mark('initLmsr', { status: 'error', error: 'Invalid liability USDC' });
      return;
    }

    const reserve0 = 1n * WAD;
    const isExpanding = true;

    const res3 = await runTx(
      () =>
        writeContractAsync({
          address: mm as `0x${string}`,
          abi: ABIS.lmsrCloneable,
          functionName: 'initMarket',
          args: [marketId, initialPositions, liabilityUSDC, reserve0, isExpanding],
        }),
      { label: 'Init LMSR' }
    );

    if (!res3) {
      mark('initLmsr', { status: 'error', error: errorMessage || 'Failed' });
      return;
    }
    mark('initLmsr', { status: 'success', txHash: res3.txHash });

    // ============================================================
    // 4) set pricing MM on Ledger
    // ============================================================
    mark('setPricingMM', { status: 'pending', error: undefined, txHash: undefined });

    const res4 = await runTx(
      () =>
        writeContractAsync({
          address: ledger as `0x${string}`,
          abi: ABIS.ledger,
          functionName: 'setPricingMarketMaker',
          args: [marketId, mm],
        }),
      { label: 'Set Pricing MM' }
    );

    if (!res4) {
      mark('setPricingMM', { status: 'error', error: errorMessage || 'Failed' });
      return;
    }
    mark('setPricingMM', { status: 'success', txHash: res4.txHash });

    // ============================================================
    // 5) optional: lock positions
    // ============================================================
    mark('lockPositions', { status: 'pending', error: undefined, txHash: undefined });

    const res5 = await runTx(
      () =>
        writeContractAsync({
          address: ledger as `0x${string}`,
          abi: ABIS.ledger,
          functionName: 'lockMarketPositions',
          args: [marketId],
        }),
      { label: 'Lock Positions' }
    );

    if (!res5) {
      mark('lockPositions', { status: 'error', error: errorMessage || 'Failed' });
      return;
    }
    mark('lockPositions', { status: 'success', txHash: res5.txHash });
  };

  return {
    status,
    errorMessage,

    createdMarketId,
    createdMM,

    steps,

    marketName,
    setMarketName,
    marketTicker,
    onMarketTickerChange,
    marketTickerOk,

    // ✅ new
    liabilityUSDCInput,
    setLiabilityUSDCInput,

    positionsCount,
    setPositionsCount,
    positions,
    updatePos,
    onPositionTickerChange,
    onPositionWeightChange,

    canCreate,
    createMarket,
  };
}
