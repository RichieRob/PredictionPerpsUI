import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// UI/scripts -> UI -> PredictionPerpsV2 -> PredictionPerpsContractsV2
const CONTRACTS_ROOT = path.resolve(
  __dirname,
  '..',
  '..',
  'PredictionPerpsContractsV2'
);

const SOURCES = [
  // ───────── Ledger core ─────────
  {
    artifactPath:
      'artifacts/Contracts/Ledger/Ledger.sol/Ledger.json',
    outFile: 'MarketMakerLedger.json',
  },
  {
    artifactPath:
      'artifacts/Contracts/Ledger/LedgerViews.sol/LedgerViews.json',
    outFile: 'LedgerViews.json',
  },
  {
    artifactPath:
      'artifacts/Contracts/Ledger/ppUSDC.sol/PpUSDC.json',
    outFile: 'PpUSDC.json',
  },
  {
    artifactPath:
      'artifacts/Contracts/Ledger/IntentContract.sol/IntentContract.json',
    outFile: 'IntentContract.json',
  },

  // ───────── Oracles / mocks (dev) ─────────
  {
    artifactPath:
      'artifacts/Contracts/Ledger/Mocks/MockOracle.sol/MockOracle.json',
    outFile: 'MockOracle.json',
  },

  // ───────── Market Maker system ─────────
  {
    artifactPath:
      'artifacts/Contracts/AMM/MarketMakerHub.sol/MarketMakerHub.json',
    outFile: 'MarketMakerHub.json',
  },
  {
    artifactPath:
      'artifacts/Contracts/AMM/FixedWeightStaticMarketMaker.sol/FixedWeightStaticMarketMaker.json',
    outFile: 'FixedWeightStaticMarketMaker.json',
  },
  {
    artifactPath:
      'artifacts/Contracts/AMM/LMSRCloneable.sol/LMSRCloneable.json',
    outFile: 'LMSRCloneable.json',
  },
];

const DEST_DIR = path.resolve(__dirname, '..', 'src', 'config', 'abis');

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

for (const { artifactPath, outFile } of SOURCES) {
  const fullArtifactPath = path.join(CONTRACTS_ROOT, artifactPath);

  if (!fs.existsSync(fullArtifactPath)) {
    console.error('❌ Missing artifact:', fullArtifactPath);
    continue;
  }

  const raw = JSON.parse(fs.readFileSync(fullArtifactPath, 'utf8'));

  // Trim to ABI only (frontend never needs bytecode)
  const trimmed = { abi: raw.abi };

  const destPath = path.join(DEST_DIR, outFile);
  fs.writeFileSync(destPath, JSON.stringify(trimmed, null, 2));
  console.log('✅ Synced ABI ->', destPath);
}
