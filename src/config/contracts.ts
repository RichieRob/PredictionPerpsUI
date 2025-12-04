import marketMakerLedgerAbiJson from './abis/MarketMakerLedger.json';
import ppUsdcAbiJson from './abis/PpUSDC.json';
import lmsrAbiJson from './abis/LMSRMarketMaker.json';
import ledgerViewsAbiJson from './abis/LedgerViews.json'

import deploymentsJson from '../../../PredictionPerpsContractsV2/deployments.json';

// ---- Types that match your deployments.json ----

interface CoreDeployment {
  chainId: string;
  deployer: string;
  MockUSDC: string;
  MockAUSDC: string;
  MockAavePool: string;
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

// Optional sanity check
if (deployments.core.chainId !== '11155111') {
  console.warn(
    `⚠ Loaded deployments for chain ${deployments.core.chainId}, expected Sepolia (11155111).`
  );
}

// ---- Addresses for the app ----

export const CONTRACTS = {
  sepolia: {
    deployer:     deployments.core.deployer,
    ledger:       deployments.core.Ledger,
    ledgerViews:  deployments.core.LedgerViews,
    ppUSDC:       deployments.core.PpUSDC,
    usdc:         deployments.core.MockUSDC,
    ausdc:        deployments.core.MockAUSDC,
    aavePool:     deployments.core.MockAavePool,
    positionImpl: deployments.core.PositionERC20,
    permit2:      deployments.core.Permit2,

    lmsr:     deployments.lmsr.LMSRMarketMaker,
    marketId: BigInt(deployments.lmsr.marketId),
  },
} as const;

// ---- ABIs ----

export const ABIS = {
  ledger: (marketMakerLedgerAbiJson as any).abi,
  ledgerViews: (ledgerViewsAbiJson as any).abi,
  ppUSDC: (ppUsdcAbiJson as any).abi,
  lmsr:   (lmsrAbiJson as any).abi,
};
