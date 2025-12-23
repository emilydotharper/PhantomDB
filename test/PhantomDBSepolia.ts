import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { deployments, ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { PhantomDB } from "../types";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("PhantomDBSepolia", function () {
  let signers: Signers;
  let phantomDB: PhantomDB;
  let phantomDBAddress: string;

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const deployment = await deployments.get("PhantomDB");
      phantomDBAddress = deployment.address;
      phantomDB = await ethers.getContractAt("PhantomDB", deployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  it("adds and decrypts a purchase record", async function () {
    this.timeout(4 * 40000);

    await fhevm.initializeCLIApi();

    const encryptedInput = await fhevm
      .createEncryptedInput(phantomDBAddress, signers.alice.address)
      .add32(1001)
      .add32(1)
      .add64(500n)
      .encrypt();

    const tx = await phantomDB
      .connect(signers.alice)
      .addPurchase("SepoliaTest", encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.inputProof);
    await tx.wait();

    const count = await phantomDB.getPurchaseCount(signers.alice.address);
    expect(count).to.be.greaterThan(0n);

    const lastIndex = count - 1n;
    const purchase = await phantomDB.getPurchase(signers.alice.address, lastIndex);
    expect(purchase[1]).to.eq("SepoliaTest");

    const decryptedQuantity = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      purchase[2],
      phantomDBAddress,
      signers.alice,
    );
    expect(decryptedQuantity).to.eq(1);
  });
});

