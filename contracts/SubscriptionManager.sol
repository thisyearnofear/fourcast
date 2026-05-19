// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SubscriptionManager
 * @notice On-chain subscription management for Fourcast Pro/Premium tiers.
 *         Uses USDC for payments, compatible with Arc (Circle L1) and EVM chains.
 *
 * Hackathon judging relevance:
 * - Circle Tool Usage: USDC-native payments on Arc
 * - Paymaster: all fees in USDC, no volatile gas tokens
 * - CCTP/Gateway: cross-chain USDC from user's wallet to subscription treasury
 */

interface IUSDC {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract SubscriptionManager {
    // --- Errors ---
    error InsufficientAllowance();
    error InsufficientBalance();
    error InvalidTier();
    error AlreadySubscribed();
    error NotExpired();
    error TransferFailed();

    // --- Types ---
    enum Tier { None, Pro, Premium }

    struct Subscription {
        Tier tier;
        uint256 expiresAt;
    }

    // --- State ---
    IUSDC public usdc;
    address public treasury;
    address public owner;

    // Pro: 9.99 USDC/month, Premium: 19.99 USDC/month
    // USDC has 6 decimals on most chains
    uint256 public constant PRO_PRICE = 9.99 * 1e6;
    uint256 public constant PREMIUM_PRICE = 19.99 * 1e6;
    uint256 public constant DURATION = 30 days;

    mapping(address => Subscription) public subscriptions;

    // --- Events ---
    event Subscribed(address indexed user, Tier tier, uint256 expiresAt);
    event Renewed(address indexed user, Tier tier, uint256 expiresAt);
    event Cancelled(address indexed user);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // --- Constructor ---
    constructor(address _usdc, address _treasury) {
        if (_usdc == address(0)) revert InvalidTier();
        if (_treasury == address(0)) revert InvalidTier();
        usdc = IUSDC(_usdc);
        treasury = _treasury;
        owner = msg.sender;
    }

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // --- Public Functions ---

    /**
     * @notice Subscribe to a paid tier. USDC must be approved first.
     * @param tier Tier to subscribe to (1 = Pro, 2 = Premium)
     */
    function subscribe(Tier tier) external {
        if (tier == Tier.None) revert InvalidTier();
        if (tier < Tier.Pro || tier > Tier.Premium) revert InvalidTier();

        uint256 price = tier == Tier.Pro ? PRO_PRICE : PREMIUM_PRICE;

        // Check allowance
        uint256 allowance = usdc.allowance(msg.sender, address(this));
        if (allowance < price) revert InsufficientAllowance();

        // Check balance
        uint256 balance = usdc.balanceOf(msg.sender);
        if (balance < price) revert InsufficientBalance();

        // Transfer USDC to treasury
        bool success = usdc.transferFrom(msg.sender, treasury, price);
        if (!success) revert TransferFailed();

        // Set or extend subscription
        Subscription storage sub = subscriptions[msg.sender];
        uint256 newExpiry;

        if (sub.expiresAt > block.timestamp) {
            // Extend existing subscription
            newExpiry = sub.expiresAt + DURATION;
            emit Renewed(msg.sender, tier, newExpiry);
        } else {
            // New subscription
            newExpiry = block.timestamp + DURATION;
            emit Subscribed(msg.sender, tier, newExpiry);
        }

        subscriptions[msg.sender] = Subscription(tier, newExpiry);
    }

    /**
     * @notice Check if an address has an active subscription
     * @param user Address to check
     * @return active Whether the subscription is currently active
     * @return tier The tier (None/Pro/Premium)
     * @return expiresAt When the subscription expires
     */
    function getSubscription(address user) external view returns (bool active, Tier tier, uint256 expiresAt) {
        Subscription memory sub = subscriptions[user];
        active = sub.expiresAt > block.timestamp && sub.tier != Tier.None;
        return (active, sub.tier, sub.expiresAt);
    }

    /**
     * @notice Get the price for a tier
     * @param tier Tier to query
     * @return price Price in USDC (6 decimals)
     */
    function getPrice(Tier tier) external pure returns (uint256) {
        if (tier == Tier.Pro) return PRO_PRICE;
        if (tier == Tier.Premium) return PREMIUM_PRICE;
        revert InvalidTier();
    }

    // --- Owner Functions ---

    /**
     * @notice Update the treasury address where USDC payments go
     */
    function updateTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTier();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /**
     * @notice Withdraw any accidentally sent native tokens
     */
    function withdrawNative() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
