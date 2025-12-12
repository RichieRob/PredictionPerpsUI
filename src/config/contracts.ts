// src/config/contracts.ts
import marketMakerLedgerAbiJson from './abis/MarketMakerLedger.json';
import ppUsdcAbiJson from './abis/PpUSDC.json';
import ledgerViewsAbiJson from './abis/LedgerViews.json';
import mockOracleAbiJson from './abis/MockOracle.json';

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

interface LmsrDeployment {
  LMSRMarketMaker: string;
  marketId: string;
  marketName: string;
  marketTicker: string;
}

interface Deployments {
  core: CoreDeployment;
  lmsr: LmsrDeployment;
}

const deployments = deploymentsJson as Deployments;

if (deployments.core.chainId !== '11155111') {
  console.warn(
    `⚠ Loaded deployments for chain ${deployments.core.chainId}, expected Sepolia (11155111).`
  );
}

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

    // optional convenience
    marketId: BigInt(deployments.lmsr.marketId),
  },
} as const;

export const ABIS = {
  ledger: (marketMakerLedgerAbiJson as any).abi,
  ledgerViews: (ledgerViewsAbiJson as any).abi,
  ppUSDC: (ppUsdcAbiJson as any).abi,
  mockOracle: (mockOracleAbiJson as any).abi,

  // ✅ IMarketMaker view ABI (matches your Solidity interface)
  marketMaker: [
    {
      type: 'function',
      name: 'getAllBackPricesWad',
      stateMutability: 'view',
      inputs: [{ name: 'marketId', type: 'uint256' }],
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
      inputs: [{ name: 'marketId', type: 'uint256' }],
      outputs: [
        { name: 'positionIds', type: 'uint256[]' },
        { name: 'priceWads', type: 'uint256[]' },
      ],
    },
    {
      type: 'function',
      name: 'getReservePriceWad',
      stateMutability: 'view',
      inputs: [{ name: 'marketId', type: 'uint256' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ],
} as const;
