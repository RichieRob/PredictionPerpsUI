import marketMakerLedgerAbiJson from './abis/MarketMakerLedger.json';
import ppUsdcAbiJson from './abis/PpUSDC.json';
import deploymentsJson from '../../../PredictionPerpsContractsV2/deployments.json';

// Type the imported deployments.json for safety (only the fields we need)
interface CoreDeployment {
  chainId: string;
  Ledger: string;
  PpUSDC: string;
  MockUSDC: string;
  // Add more if you use them later (e.g., PositionERC20, Permit2)
}

interface Deployments {
  core: CoreDeployment;
  // lmsr: {...} if needed later
}

const deployments = deploymentsJson as Deployments;

// Optional: Runtime check to ensure this is Sepolia (chainId 11155111)
if (deployments.core.chainId !== '11155111') {
  throw new Error(`Deployments file is for chain ${deployments.core.chainId}, but we expect Sepolia (11155111)`);
}

export const CONTRACTS = {
  sepolia: {
    ledger: deployments.core.Ledger,     // e.g., "0x098e80B116905AB8f73e82626B865b1668737686"
    ppUSDC: deployments.core.PpUSDC,     // e.g., "0x108D319E4Ccde2782ff437Dc4DA48F94Ce4A25E6"
    usdc: deployments.core.MockUSDC,     // e.g., "0xbA4692B57078599C6Ac540A8B9E39a3DF6660AE2" 👈 MockUSDC
  },
} as const;

export const ABIS = {
  ledger: (marketMakerLedgerAbiJson as any).abi,
  ppUSDC: (ppUsdcAbiJson as any).abi,
};