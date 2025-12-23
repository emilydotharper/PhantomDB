import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { isAddress } from 'viem';

import { DEFAULT_CONTRACT_ADDRESS } from '../config/contracts';
import { Header } from './Header';
import { PurchaseForm } from './PurchaseForm';
import { PurchaseRecords } from './PurchaseRecords';
import '../styles/PurchaseApp.css';

type Tab = 'add' | 'records';

export function PurchaseApp() {
  const { address } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>('add');
  const [contractAddressInput, setContractAddressInput] = useState<string>(DEFAULT_CONTRACT_ADDRESS);
  const [refreshKey, setRefreshKey] = useState(0);

  const contractAddress = useMemo(() => {
    const trimmed = contractAddressInput.trim();
    return isAddress(trimmed) ? (trimmed as `0x${string}`) : null;
  }, [contractAddressInput]);

  const onPurchaseAdded = () => {
    setActiveTab('records');
    setRefreshKey((v) => v + 1);
  };

  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        <section className="card">
          <h2 className="card-title">Contract</h2>
          <p className="card-subtitle">
            Enter your deployed PhantomDB contract address. The app never stores it locally.
          </p>
          <div className="contract-row">
            <input
              className="text-input"
              value={contractAddressInput}
              onChange={(e) => setContractAddressInput(e.target.value)}
              placeholder="0x..."
              spellCheck={false}
              inputMode="text"
              autoComplete="off"
            />
            <button
              className="button secondary"
              type="button"
              onClick={() => setRefreshKey((v) => v + 1)}
              disabled={!contractAddress || !address}
            >
              Refresh
            </button>
          </div>
          {!contractAddressInput.trim() ? (
            <p className="hint">Deploy first, then paste the address here.</p>
          ) : contractAddress ? (
            <p className="hint ok">Using {contractAddress}</p>
          ) : (
            <p className="hint error">Invalid address</p>
          )}
        </section>

        <section className="card">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${activeTab === 'add' ? 'active' : ''}`}
              onClick={() => setActiveTab('add')}
            >
              Add Purchase
            </button>
            <button
              type="button"
              className={`tab ${activeTab === 'records' ? 'active' : ''}`}
              onClick={() => setActiveTab('records')}
              disabled={!address}
            >
              Records
            </button>
          </div>

          {!address ? (
            <div className="empty">
              <p>Connect your wallet to add and decrypt records.</p>
            </div>
          ) : !contractAddress ? (
            <div className="empty">
              <p>Enter a valid contract address to continue.</p>
            </div>
          ) : activeTab === 'add' ? (
            <PurchaseForm contractAddress={contractAddress} onSuccess={onPurchaseAdded} />
          ) : (
            <PurchaseRecords contractAddress={contractAddress} refreshKey={refreshKey} />
          )}
        </section>

        <section className="card">
          <h2 className="card-title">Privacy</h2>
          <ul className="bullet-list">
            <li>On-chain fields (user id, quantity, amount) are stored encrypted.</li>
            <li>The Records view shows ciphertext handles; click Decrypt to reveal values.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
