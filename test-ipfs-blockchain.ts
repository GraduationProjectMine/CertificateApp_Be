import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

// ============================================================
// TEST: Verify IPFS (Pinata) upload & Blockchain registration
// ============================================================

const PINATA_JWT = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI1ZjM4NjQzZC1hNDliLTQyNzktYjJkMy0yYzY1OGNjN2I0NmUiLCJlbWFpbCI6Im5ndXllbmR1Y2NvbmdtaW5oMzRAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6ImFmN2ExNjBiNmEzMTQ1YzcwN2Q3Iiwic2NvcGVkS2V5U2VjcmV0IjoiYjVkOWE3MjI3NWQxNWM4ZWNkYzk5NDgxNTZjOGYzYzE5YzI5NTI2NWI1MTU2OTdiYzJiZGY0NzM5NGQyMmVlMiIsImV4cCI6MTgxNjgwOTY2NX0.Ywt2yG5DwIdPVbCO2pUvlcCm9DazWbtHpr6OrCSGJ5s`;

const PINATA_GATEWAY = 'https://gateway.pinata.cloud';
const IMAGE_PATH = 'C:\\DoAn\\image.png';

const GATEWAYS = [
  'https://gateway.pinata.cloud',
  'https://ipfs.io',
  'https://cloudflare-ipfs.com',
  'https://gateway.ipfs.io',
];

async function testPinataAuth(): Promise<boolean> {
  console.log('\n=== TEST 1: Pinata Authentication ===');
  try {
    const res = await fetch('https://api.pinata.cloud/data/testAuthentication', {
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      signal: AbortSignal.timeout(10000),
    });
    const ok = res.ok;
    console.log(`  Status: ${res.status} ${ok ? '✅ OK' : '❌ FAILED'}`);
    return ok;
  } catch (err) {
    console.log(`  Network error: ${err.message} ❌`);
    return false;
  }
}

async function testUploadImageToPinata(): Promise<string | null> {
  console.log('\n=== TEST 2: Upload image.png to Pinata (pinFileToIPFS) ===');
  try {
    if (!existsSync(IMAGE_PATH)) {
      console.log(`  File NOT found at ${IMAGE_PATH} ❌`);
      return null;
    }
    const fileBuffer = readFileSync(IMAGE_PATH);
    const sha3File = createHash('sha3-256').update(fileBuffer).digest('hex');
    console.log(`  File size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`  SHA-3 (file): ${sha3File}`);

    const fileName = `cert_test_${Date.now()}.png`;
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'image/png' });
    formData.append('file', blob, fileName);
    formData.append('pinataMetadata', JSON.stringify({
      name: fileName,
      keyvalues: { testRun: 'true', timestamp: String(Date.now()) },
    }));
    formData.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log(`  Upload FAILED: HTTP ${res.status} - ${errText} ❌`);
      return null;
    }

    const data = (await res.json()) as { IpfsHash: string };
    const cid = data.IpfsHash;
    console.log(`  Upload SUCCESS ✅`);
    console.log(`  CID: ${cid}`);
    console.log(`  URL: ${PINATA_GATEWAY}/ipfs/${cid}`);
    return cid;
  } catch (err) {
    console.log(`  Error: ${err.message} ❌`);
    return null;
  }
}

async function testRetrieveFromGateways(cid: string): Promise<void> {
  console.log('\n=== TEST 3: Retrieve from multiple IPFS gateways ===');
  for (const gw of GATEWAYS) {
    const url = `${gw}/ipfs/${cid}`;
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok || res.status === 200) {
        console.log(`  ${url} => ✅ (HTTP ${res.status})`);
      } else {
        console.log(`  ${url} => ❌ (HTTP ${res.status})`);
      }
    } catch (err: any) {
      if (err.code === 'ENOTFOUND' || err.cause?.code === 'ENOTFOUND') {
        console.log(`  ${url} => ⚠️  DNS resolution failed (no internet?)`);
      } else {
        console.log(`  ${url} => ❌ ${err.message.slice(0, 60)}`);
      }
    }
  }
}

async function testUploadMetadataJsonToPinata(): Promise<string | null> {
  console.log('\n=== TEST 4: Upload metadata JSON to Pinata (pinJSONToIPFS) ===');
  try {
    const certData = {
      documentTitle: 'BẰNG TỐT NGHIỆP THPT',
      fullName: 'NGUYỄN VĂN A',
      serialNumber: `TEST-${Date.now()}`,
      registryNumber: `REG-${Date.now()}`,
    };
    const sha3 = createHash('sha3-256').update(JSON.stringify(certData)).digest('hex');

    const payload = {
      pinataContent: { ...certData, sha3Hash: sha3 },
      pinataMetadata: {
        name: `cert_test_${Date.now()}`,
        keyvalues: { testRun: 'true', sha3Hash: sha3 },
      },
      pinataOptions: { cidVersion: 1 },
    };

    const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PINATA_JWT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.log(`  Upload FAILED: HTTP ${res.status} - ${errText} ❌`);
      return null;
    }

    const data = (await res.json()) as { IpfsHash: string };
    const cid = data.IpfsHash;
    console.log(`  Upload SUCCESS ✅`);
    console.log(`  CID: ${cid}`);
    console.log(`  SHA-3: ${sha3}`);
    console.log(`  URL: ${PINATA_GATEWAY}/ipfs/${cid}`);

    // Fetch back the JSON content
    console.log('\n  === Verify: Fetch JSON back from gateway ===');
    try {
      const getRes = await fetch(`${PINata_GATEWAY}/ipfs/${cid}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (getRes.ok) {
        const json = await getRes.json();
        console.log(`  Gateway returned JSON ✅`);
        console.log(`  Content: ${JSON.stringify(json, null, 2).slice(0, 300)}...`);
      } else {
        console.log(`  Gateway returned HTTP ${getRes.status} ❌`);
      }
    } catch (err: any) {
      console.log(`  Gateway retrieval error: ${err.message.slice(0, 80)}`);
    }

    return cid;
  } catch (err) {
    console.log(`  Error: ${err.message} ❌`);
    return null;
  }
}

async function testBlockchainConnection(): Promise<void> {
  console.log('\n=== TEST 5: Blockchain Connection ===');
  const RPC_URL = 'http://127.0.0.1:8545';
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const blockNum = parseInt(data.result, 16);
      console.log(`  Connected to local Hardhat node ✅`);
      console.log(`  Current block: ${blockNum}`);

      const chainRes = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_chainId',
          params: [],
          id: 2,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (chainRes.ok) {
        const chainData = await chainRes.json();
        const chainId = parseInt(chainData.result, 16);
        console.log(`  Chain ID: ${chainId} (31337 = Hardhat local) ${chainId === 31337 ? '✅' : '⚠️'}`);
      }
    } else {
      console.log(`  Cannot connect to ${RPC_URL} ❌`);
      console.log(`  Make sure your local Hardhat node is running:`);
      console.log(`  cd bc && npx hardhat node`);
    }
  } catch (err: any) {
    console.log(`  Connection error: ${err.message.slice(0, 80)} ❌`);
    console.log(`  Make sure your local Hardhat node is running:`);
    console.log(`  cd bc && npx hardhat node`);
  }
}

// -----------------------------------------------------------
// MAIN
// -----------------------------------------------------------
async function main() {
  console.log('============================================================');
  console.log('  CertiChain - IPFS & Blockchain Integration Test');
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log('============================================================');

  // 1. Pinata auth
  const authOk = await testPinataAuth();
  if (!authOk) {
    console.log('\n⚠️  Pinata auth failed. Check your PINATA_JWT.');
  }

  // 2. Upload image
  let imageCid: string | null = null;
  if (authOk) {
    imageCid = await testUploadImageToPinata();
    if (imageCid) {
      await testRetrieveFromGateways(imageCid);
    }
  }

  // 3. Upload metadata JSON
  let jsonCid: string | null = null;
  if (authOk) {
    jsonCid = await testUploadMetadataJsonToPinata();
  }

  // 4. Blockchain connection
  await testBlockchainConnection();

  // Summary
  console.log('\n============================================================');
  console.log('  RESULTS SUMMARY');
  console.log('============================================================');
  console.log(`  Pinata Auth:        ${authOk ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Image Upload:       ${imageCid ? `✅ PASS (CID: ${imageCid})` : '❌ FAIL'}`);
  console.log(`  JSON Upload:        ${jsonCid ? `✅ PASS (CID: ${jsonCid})` : '❌ FAIL'}`);
  console.log('');
  console.log('  ROOT CAUSE ANALYSIS of your "bafk_pending_" issue:');
  console.log('  -------------------------------------------------');
  console.log('  In certificate.service.ts createDraft():');
  console.log('  - Line 93-109: Tries to upload base64 image to Pinata');
  console.log('  - Line 107: The try/catch SILENTLY swallows upload failures!');
  console.log('  - Line 112-115: If no CID, generates FAKE "bafk_pending_..."');
  console.log(`  - When approve() runs, file_url is already "https://gateway...",`);
  console.log(`    so line 272 check "startsWith('data:')" == FALSE → skip re-upload`);
  console.log('  - The certificate gets issued on-chain with a FAKE CID');
  console.log('');
  console.log('  SUGGESTED FIX:');
  console.log('  1. Remove the silent try/catch on line 107-109');
  console.log('  2. Remove the "bafk_pending_" fallback entirely');
  console.log('  3. In approve(), always try to upload the IPFS payload (metadata JSON)');
  console.log('  4. Add clear error messages for Pinata failures');
  console.log('============================================================');
}

main().catch(console.error);