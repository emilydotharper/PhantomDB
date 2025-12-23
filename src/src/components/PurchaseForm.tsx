import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { Contract } from 'ethers';

import { CONTRACT_ABI } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/PurchaseForm.css';

type Props = {
  contractAddress: `0x${string}`;
  onSuccess: () => void;
};

function parseUint32(value: string): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) return null;
  return n;
}

function parseUint64(value: string): bigint | null {
  try {
    const b = BigInt(value);
    if (b < 0n || b > 0xffffffffffffffffn) return null;
    return b;
  } catch {
    return null;
  }
}

export function PurchaseForm({ contractAddress, onSuccess }: Props) {
  const { address } = useAccount();
  const signerPromise = useEthersSigner();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [userId, setUserId] = useState('');
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string>('');

  const parsed = useMemo(() => {
    return {
      userId: parseUint32(userId.trim()),
      quantity: parseUint32(quantity.trim()),
      amount: parseUint64(amount.trim()),
      item: item.trim(),
    };
  }, [userId, quantity, amount, item]);

  const canSubmit =
    !!address &&
    !!instance &&
    !!signerPromise &&
    !!parsed.item &&
    parsed.item.length <= 64 &&
    parsed.userId !== null &&
    parsed.quantity !== null &&
    parsed.amount !== null &&
    !isSubmitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !address || !instance || !signerPromise) return;

    setIsSubmitting(true);
    setTxHash('');
    try {
      const input = instance.createEncryptedInput(contractAddress, address);
      input.add32(parsed.userId as number);
      input.add32(parsed.quantity as number);
      input.add64(parsed.amount as bigint);
      const encryptedInput = await input.encrypt();

      const signer = await signerPromise;
      if (!signer) throw new Error('Signer not available');

      const phantomDB = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await phantomDB.addPurchase(
        parsed.item,
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.inputProof,
      );

      setTxHash(tx.hash as string);
      await tx.wait();
      onSuccess();
    } catch (err) {
      console.error(err);
      alert(`Failed to add purchase: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="purchase-form">
      <h3 className="section-title">New Purchase</h3>

      {zamaError ? <p className="hint error">{zamaError}</p> : null}
      {zamaLoading ? <p className="hint">Initializing encryption service…</p> : null}

      <form onSubmit={submit} className="form-grid">
        <label className="field">
          <span className="label">User ID (encrypted)</span>
          <input
            className="text-input"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="e.g. 1001"
            inputMode="numeric"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="label">Item (plaintext)</span>
          <input
            className="text-input"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="e.g. Coffee"
            autoComplete="off"
          />
          <span className="field-hint">Max 64 characters.</span>
        </label>

        <label className="field">
          <span className="label">Quantity (encrypted)</span>
          <input
            className="text-input"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g. 2"
            inputMode="numeric"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span className="label">Amount (encrypted)</span>
          <input
            className="text-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 700"
            inputMode="numeric"
            autoComplete="off"
          />
          <span className="field-hint">Use an integer (for example cents).</span>
        </label>

        <div className="actions">
          <button type="submit" className="button primary" disabled={!canSubmit}>
            {isSubmitting ? 'Submitting…' : 'Add Purchase'}
          </button>
          {txHash ? (
            <a
              className="link"
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
          ) : null}
        </div>
      </form>
    </div>
  );
}

