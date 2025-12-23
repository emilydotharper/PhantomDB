import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { PhantomDB, PhantomDB__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("PhantomDB")) as PhantomDB__factory;
  const phantomDB = (await factory.deploy()) as PhantomDB;
  const phantomDBAddress = await phantomDB.getAddress();
  return { phantomDB, phantomDBAddress };
}

describe("PhantomDB", function () {
  let signers: Signers;
  let phantomDB: PhantomDB;
  let phantomDBAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ phantomDB, phantomDBAddress } = await deployFixture());
  });

  it("starts with zero purchases", async function () {
    const count = await phantomDB.getPurchaseCount(signers.alice.address);
    expect(count).to.eq(0n);
  });

  it("adds and decrypts a purchase record", async function () {
    const clearUserId = 1001;
    const clearQuantity = 2;
    const clearAmount = 700n;

    const encryptedInput = await fhevm
      .createEncryptedInput(phantomDBAddress, signers.alice.address)
      .add32(clearUserId)
      .add32(clearQuantity)
      .add64(clearAmount)
      .encrypt();

    const tx = await phantomDB
      .connect(signers.alice)
      .addPurchase("Coffee", encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.inputProof);
    await tx.wait();

    const count = await phantomDB.getPurchaseCount(signers.alice.address);
    expect(count).to.eq(1n);

    const purchase = await phantomDB.getPurchase(signers.alice.address, 0n);
    expect(purchase[1]).to.eq("Coffee");
    expect(purchase[4]).to.be.greaterThan(0n);

    const decryptedUserId = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      purchase[0],
      phantomDBAddress,
      signers.alice,
    );
    const decryptedQuantity = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      purchase[2],
      phantomDBAddress,
      signers.alice,
    );
    const decryptedAmount = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      purchase[3],
      phantomDBAddress,
      signers.alice,
    );

    expect(decryptedUserId).to.eq(clearUserId);
    expect(decryptedQuantity).to.eq(clearQuantity);
    expect(decryptedAmount).to.eq(clearAmount);
  });

  it("rejects empty item name", async function () {
    const encryptedInput = await fhevm
      .createEncryptedInput(phantomDBAddress, signers.alice.address)
      .add32(1)
      .add32(1)
      .add64(1n)
      .encrypt();

    await expect(
      phantomDB
        .connect(signers.alice)
        .addPurchase("", encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.inputProof),
    ).to.be.revertedWithCustomError(phantomDB, "InvalidItem");
  });
});

