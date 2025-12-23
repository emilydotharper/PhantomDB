// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, euint64, externalEuint32, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PhantomDB
/// @notice Merchants store encrypted purchase records for their users.
contract PhantomDB is ZamaEthereumConfig {
    struct Purchase {
        euint32 userId;
        string item;
        euint32 quantity;
        euint64 amount;
        uint64 timestamp;
    }

    mapping(address merchant => Purchase[] purchases) private _purchasesByMerchant;

    event PurchaseAdded(address indexed merchant, uint256 indexed index, string item, uint64 timestamp);

    error InvalidIndex();
    error InvalidItem();

    /// @notice Add a new encrypted purchase record for the caller (merchant).
    /// @param item The purchased item name (plaintext).
    /// @param userIdExt Encrypted user id (external handle).
    /// @param quantityExt Encrypted quantity (external handle).
    /// @param amountExt Encrypted amount (external handle).
    /// @param inputProof Proof for the encrypted inputs.
    function addPurchase(
        string calldata item,
        externalEuint32 userIdExt,
        externalEuint32 quantityExt,
        externalEuint64 amountExt,
        bytes calldata inputProof
    ) external {
        if (bytes(item).length == 0 || bytes(item).length > 64) revert InvalidItem();

        euint32 userId = FHE.fromExternal(userIdExt, inputProof);
        euint32 quantity = FHE.fromExternal(quantityExt, inputProof);
        euint64 amount = FHE.fromExternal(amountExt, inputProof);

        _purchasesByMerchant[msg.sender].push(
            Purchase({
                userId: userId,
                item: item,
                quantity: quantity,
                amount: amount,
                timestamp: uint64(block.timestamp)
            })
        );

        uint256 index = _purchasesByMerchant[msg.sender].length - 1;
        Purchase storage p = _purchasesByMerchant[msg.sender][index];

        // Allow the contract and the merchant to use and decrypt the ciphertexts.
        FHE.allowThis(p.userId);
        FHE.allow(p.userId, msg.sender);

        FHE.allowThis(p.quantity);
        FHE.allow(p.quantity, msg.sender);

        FHE.allowThis(p.amount);
        FHE.allow(p.amount, msg.sender);

        emit PurchaseAdded(msg.sender, index, item, uint64(block.timestamp));
    }

    /// @notice Get the number of purchase records for a merchant.
    /// @param merchant The merchant address.
    function getPurchaseCount(address merchant) external view returns (uint256) {
        return _purchasesByMerchant[merchant].length;
    }

    /// @notice Get a purchase record (encrypted fields remain encrypted).
    /// @param merchant The merchant address.
    /// @param index The record index (0-based).
    function getPurchase(address merchant, uint256 index)
        external
        view
        returns (euint32 userId, string memory item, euint32 quantity, euint64 amount, uint64 timestamp)
    {
        if (index >= _purchasesByMerchant[merchant].length) revert InvalidIndex();
        Purchase storage p = _purchasesByMerchant[merchant][index];
        return (p.userId, p.item, p.quantity, p.amount, p.timestamp);
    }
}
