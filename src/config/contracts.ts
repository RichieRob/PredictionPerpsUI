// src/config/contracts.ts
import marketMakerLedgerAbiJson from './abis/MarketMakerLedger.json';
import ppUsdcAbiJson from './abis/PpUSDC.json';
import ledgerViewsAbiJson from './abis/LedgerViews.json';
import mockOracleAbiJson from './abis/MockOracle.json';

import marketMakerHubAbiJson from './abis/MarketMakerHub.json';
import lmsrCloneableAbiJson from './abis/LMSRCloneable.json';

import deploymentsJson from '../../../PredictionPerpsContractsV2/deployments.json';

interface CoreDeployment {
  chainId: string;
  deployer: string;
  MockUSDC: string;
  MockAUSDC: string;
  MockAavePool: string;
  MockOracle: string;
  PpUSDC: string;
  Ledger: string;
  LedgerViews: string;
  PositionERC20: string;
  Permit2: string;
}

interface AmmDeployment {
  MarketMakerHub: string;
  TYPE_LMSR: string; // bytes32 string in json
  LMSRCloneableImpl: string;
}

interface LmsrDeployment {
  marketId: string;
  marketName: string;
  marketTicker: string;
  dmm: string;
  pricingMM: string;
  hub: string;
  lmsrImpl: string;
}

interface Deployments {
  core: CoreDeployment;
  lmsr?: LmsrDeployment;
  amm: AmmDeployment;
}

const deployments = deploymentsJson as Deployments;

export const CONTRACTS = {
  sepolia: {
    deployer:     deployments.core.deployer,
    ledger:       deployments.core.Ledger,
    ledgerViews:  deployments.core.LedgerViews,
    ppUSDC:       deployments.core.PpUSDC,
    usdc:         deployments.core.MockUSDC,
    ausdc:        deployments.core.MockAUSDC,
    aavePool:     deployments.core.MockAavePool,
    mockOracle:   deployments.core.MockOracle,
    positionImpl: deployments.core.PositionERC20,
    permit2:      deployments.core.Permit2,

    // AMM infra
    marketMakerHub: deployments.amm.MarketMakerHub,
    typeLmsr:       deployments.amm.TYPE_LMSR as `0x${string}`,

    // optional convenience
    marketId: deployments.lmsr?.marketId ? BigInt(deployments.lmsr.marketId) : 0n,
  },
} as const;

export const ABIS = {
  ledger: (marketMakerLedgerAbiJson as any).abi,
  ledgerViews: (ledgerViewsAbiJson as any).abi,
  ppUSDC: (ppUsdcAbiJson as any).abi,
  mockOracle: (mockOracleAbiJson as any).abi,

  marketMakerHub: (marketMakerHubAbiJson as any).abi,
  lmsrCloneable: (lmsrCloneableAbiJson as any).abi,

  // ✅ Minimal IMarketMaker view ABI used by pricing MM reads
  marketMaker: [
    {
      type: 'function',
      name: 'getAllBackPricesWad',
      stateMutability: 'view',
      inputs: [{ name: 'marketId_', type: 'uint256' }],
      outputs: [
        { name: 'positionIds', type: 'uint256[]' },
        { name: 'priceWads', type: 'uint256[]' },
        { name: 'reservePriceWad', type: 'uint256' },
      ],
    },
    {
      type: 'function',
      name: 'getAllLayPricesWad',
      stateMutability: 'view',
      inputs: [{ name: 'marketId_', type: 'uint256' }],
      outputs: [
        { name: 'positionIds', type: 'uint256[]' },
        { name: 'priceWads', type: 'uint256[]' },
      ],
    },
    {
      type: 'function',
      name: 'getReservePriceWad',
      stateMutability: 'view',
      inputs: [{ name: 'marketId_', type: 'uint256' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      type: 'function',
      name: 'getBackPriceWad',
      stateMutability: 'view',
      inputs: [
        { name: 'marketId_', type: 'uint256' },
        { name: 'ledgerPositionId', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      type: 'function',
      name: 'getLayPriceWad',
      stateMutability: 'view',
      inputs: [
        { name: 'marketId_', type: 'uint256' },
        { name: 'ledgerPositionId', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ] as const,
} as const;

