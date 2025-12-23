import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Examples:
 *  - npx hardhat --network localhost deploy
 *  - npx hardhat --network localhost phantomdb:address
 *  - npx hardhat --network localhost phantomdb:add-purchase --userId 1001 --item "Coffee" --quantity 2 --amount 700
 *  - npx hardhat --network localhost phantomdb:decrypt-purchase --index 0
 */

task("phantomdb:address", "Prints the PhantomDB address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const deployment = await deployments.get("PhantomDB");
  console.log("PhantomDB address is " + deployment.address);
});

task("phantomdb:add-purchase", "Adds an encrypted purchase record")
  .addOptionalParam("address", "Optionally specify the PhantomDB contract address")
  .addParam("userId", "Clear user id (uint32)")
  .addParam("item", "Item name (string)")
  .addParam("quantity", "Clear quantity (uint32)")
  .addParam("amount", "Clear amount (uint64)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const userId = parseInt(taskArguments.userId);
    const quantity = parseInt(taskArguments.quantity);
    const amount = BigInt(taskArguments.amount);

    if (!Number.isInteger(userId) || userId < 0) throw new Error(`--userId must be a non-negative integer`);
    if (!Number.isInteger(quantity) || quantity < 0) throw new Error(`--quantity must be a non-negative integer`);
    if (amount < 0n) throw new Error(`--amount must be a non-negative integer`);

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("PhantomDB");
    console.log(`PhantomDB: ${deployment.address}`);

    const [signer] = await ethers.getSigners();
    const contract = await ethers.getContractAt("PhantomDB", deployment.address);

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add32(userId)
      .add32(quantity)
      .add64(amount)
      .encrypt();

    const tx = await contract
      .connect(signer)
      .addPurchase(taskArguments.item, encryptedInput.handles[0], encryptedInput.handles[1], encryptedInput.handles[2], encryptedInput.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);
  });

task("phantomdb:decrypt-purchase", "Decrypts a purchase record for a merchant")
  .addOptionalParam("address", "Optionally specify the PhantomDB contract address")
  .addOptionalParam("merchant", "Merchant address (defaults to first signer address)")
  .addParam("index", "Purchase index (0-based)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const index = BigInt(taskArguments.index);
    if (index < 0n) throw new Error(`--index must be a non-negative integer`);

    await fhevm.initializeCLIApi();

    const deployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("PhantomDB");
    console.log(`PhantomDB: ${deployment.address}`);

    const [signer] = await ethers.getSigners();
    const merchant = taskArguments.merchant ?? signer.address;

    const contract = await ethers.getContractAt("PhantomDB", deployment.address);
    const purchase = await contract.getPurchase(merchant, index);

    const encryptedUserId = purchase[0] as string;
    const item = purchase[1] as string;
    const encryptedQuantity = purchase[2] as string;
    const encryptedAmount = purchase[3] as string;
    const timestamp = purchase[4] as bigint;

    const userId = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedUserId, deployment.address, signer);
    const quantity = await fhevm.userDecryptEuint(FhevmType.euint32, encryptedQuantity, deployment.address, signer);
    const amount = await fhevm.userDecryptEuint(FhevmType.euint64, encryptedAmount, deployment.address, signer);

    console.log(`item      : ${item}`);
    console.log(`timestamp : ${timestamp}`);
    console.log(`userId    : ${userId}`);
    console.log(`quantity  : ${quantity}`);
    console.log(`amount    : ${amount}`);
  });

