import { useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';

import { CONTRACT_ABI } from '../config/contracts';
import { publicClient } from '../lib/viem';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/PurchaseRecords.css';

type Props = {
  contractAddress: `0x${string}`;
  refreshKey: number;
};

type RecordRow = {
  index: bigint;
  item: string;
  timestamp: bigint;
  userIdHandle: `0x${string}`;
  quantityHandle: `0x${string}`;
  amountHandle: `0x${string}`;
};

type DecryptedRow = {
  userId: string;
  quantity: string;
  amount: string;
};

const MAX_TO_LOAD = 200n;

export function PurchaseRecords({ contractAddress, refreshKey }: Props) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [count, setCount] = useState<bigint>(0n);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [decryptingIndex, setDecryptingIndex] = useState<bigint | null>(null);
  const [decrypted, setDecrypted] = useState<Record<string, DecryptedRow>>({});

  const canLoad = useMemo(() => !!address && !!contractAddress, [address, contractAddress]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!canLoad || !address) return;
      setIsLoading(true);
      setError('');
      try {
        const purchaseCount = await publicClient.readContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: 'getPurchaseCount',
          args: [address],
        });

        if (cancelled) return;
        setCount(purchaseCount as bigint);

        const capped = (purchaseCount as bigint) > MAX_TO_LOAD ? MAX_TO_LOAD : (purchaseCount as bigint);
        const indices: bigint[] = [];
        for (let i = 0n; i < capped; i++) {
          indices.push((purchaseCount as bigint) - 1n - i);
        }

        const loaded = await Promise.all(
          indices.map(async (idx) => {
            const purchase = await publicClient.readContract({
              address: contractAddress,
              abi: CONTRACT_ABI,
              functionName: 'getPurchase',
              args: [address, idx],
            });
            const p = purchase as readonly [`0x${string}`, string, `0x${string}`, `0x${string}`, bigint];
            return {
              index: idx,
              userIdHandle: p[0],
              item: p[1],
              quantityHandle: p[2],
              amountHandle: p[3],
              timestamp: p[4],
            } satisfies RecordRow;
          }),
        );

        if (cancelled) return;
        setRows(loaded);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load records');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [address, canLoad, contractAddress, refreshKey]);

  const decryptRow = async (row: RecordRow) => {
    if (!instance || !address || !signerPromise) {
      alert('Missing required components for decryption');
      return;
    }

    setDecryptingIndex(row.index);
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('Signer not available');

      const keypair = instance.generateKeypair();
      const handleContractPairs = [
        { handle: row.userIdHandle, contractAddress },
        { handle: row.quantityHandle, contractAddress },
        { handle: row.amountHandle, contractAddress },
      ];

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [contractAddress];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      setDecrypted((prev) => ({
        ...prev,
        [row.index.toString()]: {
          userId: String(result[row.userIdHandle] ?? ''),
          quantity: String(result[row.quantityHandle] ?? ''),
          amount: String(result[row.amountHandle] ?? ''),
        },
      }));
    } catch (err) {
      console.error(err);
      alert(`Failed to decrypt: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDecryptingIndex(null);
    }
  };

  if (!address) {
    return (
      <div className="empty">
        <p>Connect your wallet to view records.</p>
      </div>
    );
  }

  return (
    <div className="records">
      <div className="records-header">
        <h3 className="section-title">Records</h3>
        <div className="records-meta">
          <span className="meta">Total: {count.toString()}</span>
          {count > MAX_TO_LOAD ? <span className="meta warn">Showing latest {MAX_TO_LOAD.toString()}</span> : null}
        </div>
      </div>

      {zamaError ? <p className="hint error">{zamaError}</p> : null}
      {zamaLoading ? <p className="hint">Initializing encryption service…</p> : null}
      {error ? <p className="hint error">{error}</p> : null}

      {isLoading ? (
        <p className="hint">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="empty">
          <p>No records yet.</p>
        </div>
      ) : (
        <div className="records-list">
          {rows.map((row) => {
            const d = decrypted[row.index.toString()];
            const date = new Date(Number(row.timestamp) * 1000).toLocaleString();
            return (
              <div key={row.index.toString()} className="record">
                <div className="record-top">
                  <div>
                    <div className="record-title">{row.item}</div>
                    <div className="record-subtitle">
                      #{row.index.toString()} • {date}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => void decryptRow(row)}
                    disabled={!instance || decryptingIndex === row.index}
                  >
                    {decryptingIndex === row.index ? 'Decrypting…' : 'Decrypt'}
                  </button>
                </div>

                <div className="grid">
                  <div className="kv">
                    <div className="k">User ID</div>
                    <div className="v mono">{d ? d.userId : row.userIdHandle}</div>
                  </div>
                  <div className="kv">
                    <div className="k">Quantity</div>
                    <div className="v mono">{d ? d.quantity : row.quantityHandle}</div>
                  </div>
                  <div className="kv">
                    <div className="k">Amount</div>
                    <div className="v mono">{d ? d.amount : row.amountHandle}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

