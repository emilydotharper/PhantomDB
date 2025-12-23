# PhantomDB (FHEVM)

PhantomDB is a privacy-first purchase ledger for merchants built on Zama's FHEVM. It lets merchants store user purchase data on-chain while keeping sensitive numeric fields encrypted end-to-end. Only the merchant who submitted the records can decrypt them, and decryption happens explicitly on demand.

This repository includes:
- A Solidity smart contract for storing encrypted purchase records.
- Hardhat deployment scripts, tasks, and tests.
- A React + Vite frontend that encrypts inputs, submits records, and decrypts them in the UI.

## Problem Statement

Merchants often need to record purchases for audits, analytics, and operational history, but:
- Plaintext on-chain data leaks sensitive customer information.
- Off-chain databases are harder to audit and verify.
- Regulatory and privacy requirements push for stronger confidentiality guarantees.

PhantomDB solves this by storing purchase records on-chain with fully homomorphic encryption (FHE) for the sensitive fields. The ledger remains verifiable and tamper-resistant, while private values stay encrypted until a merchant chooses to decrypt them.

## Goals

- Keep user identifiers, quantities, and monetary amounts encrypted on-chain.
- Allow merchants to decrypt their own records when needed.
- Preserve auditability without revealing sensitive data to the public chain.
- Provide a simple, end-to-end workflow from encryption to decryption in a usable UI.

## Non-Goals

- No public decryption or third-party access to merchant data.
- No user account system or identity verification in the frontend.
- No local persistence in the frontend (no local storage, no cached contract address).
- No local-chain frontend support (the UI targets Sepolia only).

## Key Features

- Encrypted storage for `userId`, `quantity`, and `amount` using FHEVM types.
- Plaintext `item` name for human-readable records (max 64 chars).
- Per-merchant record isolation: each merchant sees only their own purchases.
- On-demand decryption with explicit user action.
- Frontend encryption and decryption using Zama's relayer SDK.
- Read operations via viem; write operations via ethers.
- No frontend environment variables and no local persistence.

## Advantages

- Strong privacy guarantees with on-chain auditability.
- Encrypted numeric fields prevent data leakage even in public state.
- Explicit decryption flow ensures merchants control disclosure.
- Simple data model and predictable gas usage.
- Clear separation of concerns between contract, tasks, and UI.

## How It Works (End-to-End Flow)

1. Merchant connects a wallet on Sepolia in the UI.
2. Merchant inputs a user id, item name, quantity, and amount.
3. The UI encrypts user id, quantity, and amount with the relayer SDK.
4. The encrypted handles and proof are sent to the contract via ethers.
5. The contract stores encrypted values and grants ACL permissions to the merchant.
6. The Records view reads encrypted handles via viem.
7. The merchant clicks Decrypt to retrieve plaintext values client-side.

## Data Model

Each purchase record is stored as:
- `userId`: `euint32` (encrypted)
- `item`: `string` (plaintext, 1-64 chars)
- `quantity`: `euint32` (encrypted)
- `amount`: `euint64` (encrypted)
- `timestamp`: `uint64` (block timestamp)

Records are stored per merchant:
- `mapping(address => Purchase[]) purchasesByMerchant`

## Security and Privacy Model

- Encrypted fields are stored as ciphertext handles on-chain.
- Only the merchant address is granted access to decrypt those handles.
- The contract uses `FHE.allow` and `FHE.allowThis` for ACL permissions.
- Decryption in the UI requires a wallet signature (EIP-712) and uses the relayer.
- Plaintext metadata still exists: item names, timestamps, and record counts.

## Architecture Overview

On-chain:
- `PhantomDB.sol` stores encrypted purchase records and emits `PurchaseAdded`.

Off-chain / client:
- React UI encrypts inputs and submits transactions.
- viem public client reads ciphertext handles.
- ethers signer sends transactions for writes and signatures.
- Zama relayer SDK handles encryption and user decryption.

## Technology Stack

Smart contracts and tooling:
- Solidity 0.8.27
- Hardhat + hardhat-deploy
- @fhevm/hardhat-plugin
- TypeChain (ethers-v6 bindings)

Frontend:
- React 19 + Vite 7
- RainbowKit + wagmi
- viem (reads) and ethers (writes)
- @zama-fhe/relayer-sdk
- Plain CSS (no Tailwind)

## Project Structure

```
PhantomDB/
├── contracts/            # Smart contracts
│   ├── PhantomDB.sol     # Main encrypted purchase ledger
│   └── FHECounter.sol    # Sample FHE contract
├── deploy/               # Deployment scripts
├── tasks/                # Hardhat tasks
├── test/                 # Test suites
├── src/                  # Frontend (Vite)
│   └── src/
│       ├── abi/          # ABI in TypeScript (no JSON)
│       ├── components/   # UI components
│       ├── hooks/        # Wallet + Zama hooks
│       └── lib/          # viem client
└── hardhat.config.ts     # Hardhat configuration
```

## Smart Contract Details

Contract: `PhantomDB`
- `addPurchase(item, userIdExt, quantityExt, amountExt, inputProof)`
  - Stores encrypted fields and a plaintext item.
  - Validates item length and rejects empty values.
  - Emits `PurchaseAdded(merchant, index, item, timestamp)`.
- `getPurchaseCount(merchant)`
  - Returns number of records for a merchant.
- `getPurchase(merchant, index)`
  - Returns ciphertext handles and plaintext item + timestamp.

## Frontend Details

- The contract address is entered manually per session and is never stored locally.
- Reads use the Sepolia public RPC via viem.
- Writes and signatures use ethers and the connected wallet.
- The Records view shows ciphertext handles until Decrypt is clicked.
- The UI caps record loading to the most recent 200 entries for performance.

## Setup and Usage

### Prerequisites

- Node.js 20+
- npm
- A funded Sepolia account

### Install root dependencies

```bash
npm install
```

### Environment variables (Hardhat only)

Create a `.env` file in the repository root:
- `INFURA_API_KEY`
- `PRIVATE_KEY` (single private key, no mnemonic)
- `ETHERSCAN_API_KEY` (optional)

### Compile and test

```bash
npm run compile
npm run test
```

### Deploy locally (Hardhat node)

```bash
npx hardhat node
npx hardhat deploy --network localhost
```

### Deploy to Sepolia

```bash
npx hardhat deploy --network sepolia
```

Optional verification:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### Run Sepolia test suite

```bash
npx hardhat test --network sepolia
```

## Hardhat Tasks

- Print accounts:
  ```bash
  npx hardhat accounts
  ```

- Print deployed contract address:
  ```bash
  npx hardhat phantomdb:address --network sepolia
  ```

- Add a purchase:
  ```bash
  npx hardhat phantomdb:add-purchase --network sepolia --userId 1001 --item "Coffee" --quantity 2 --amount 700
  ```

- Decrypt a purchase (merchant-only):
  ```bash
  npx hardhat phantomdb:decrypt-purchase --network sepolia --index 0
  ```

## Frontend Setup

The frontend lives in `src/` and does not use environment variables or local storage.

1. Install frontend dependencies:

   ```bash
   cd src
   npm install
   ```

2. Ensure the frontend ABI matches the deployed contract:

   - Deploy to Sepolia.
   - Copy the ABI from `deployments/sepolia/PhantomDB.json`.
   - Paste it into `src/src/abi/PhantomDBAbi.ts` as a TypeScript array.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. In the UI:
   - Connect a Sepolia wallet.
   - Paste the deployed contract address.
   - Add a purchase and then open Records to decrypt.

## Operational Notes and Limits

- Amounts should be provided as integers (for example, cents).
- Item names are plaintext and visible on-chain.
- Decryption is permissioned to the merchant who created the record.
- The UI does not store the contract address between sessions.
- The UI only loads up to 200 latest records for performance.

## Future Roadmap

- Encrypt item names using FHE-friendly tokens or hashes.
- Batch add purchases to reduce per-entry overhead.
- Pagination and indexing for large merchant histories.
- Optional export tools for encrypted data snapshots.
- Analytics dashboards that operate on encrypted aggregates.
- Role-based access for shared merchant teams.
- Additional network support once FHEVM expands.

## License

BSD-3-Clause-Clear. See `LICENSE` for details.

## References

- Zama FHEVM documentation: https://docs.zama.ai/fhevm
- Relayer SDK docs: `docs/zama_doc_relayer.md`
- Project contract code: `contracts/PhantomDB.sol`
