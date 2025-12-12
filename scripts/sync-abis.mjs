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
  {
    artifactPath:
      'artifacts/Contracts/Ledger/Ledger.sol/Ledger.json',
    outFile: 'MarketMakerLedger.json',
  },
  {
    artifactPath:
      'artifacts/Contracts/Ledger/ppUSDC.sol/PpUSDC.json',
    outFile: 'PpUSDC.json',
  },
  {
    // MockOracle ✅
    artifactPath:
      'artifacts/Contracts/Ledger/Mocks/MockOracle.sol/MockOracle.json',
    outFile: 'MockOracle.json',
  },
  {
    artifactPath:
      'artifacts/Contracts/AMM/LMSRMarketMaker.sol/LMSRMarketMaker.json',
    outFile: 'LMSRMarketMaker.json',
  },
  {
    artifactPath:
      'artifacts/Contracts/Ledger/IntentContract.sol/IntentContract.json',
    outFile: 'IntentContract.json',
  },
  {
    artifactPath:
      'artifacts/Contracts/Ledger/LedgerViews.sol/LedgerViews.json',
    outFile: 'LedgerViews.json',
  },
];


const DEST_DIR = path.resolve(__dirname, '..', 'src', 'config', 'abis');

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

for (const { artifactPath, outFile } of SOURCES) {
  const fullArtifactPath = path.join(CONTRACTS_ROOT, artifactPath);

  if (!fs.existsSync(fullArtifactPath)) {
    console.error('Missing artifact:', fullArtifactPath);
    continue;
  }

  const raw = JSON.parse(fs.readFileSync(fullArtifactPath, 'utf8'));
  const trimmed = { abi: raw.abi };

  const destPath = path.join(DEST_DIR, outFile);
  fs.writeFileSync(destPath, JSON.stringify(trimmed, null, 2));
  console.log('Synced ABI ->', destPath);
}
