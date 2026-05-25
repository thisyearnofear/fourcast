// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PredictionReceiptERC20 is Ownable, Pausable, ReentrancyGuard {
    struct Prediction {
        address user;
        uint256 marketId;
        string side;
        uint256 stakeUnits;
        uint16 oddsBps;
        string uri;
        uint256 timestamp;
    }

    mapping(bytes32 => Prediction) public predictions;
    uint16 public feeBps;
    address public treasury;
    IERC20 public immutable token;

    event PredictionPlaced(
        address indexed user,
        uint256 indexed marketId,
        bytes32 indexed id,
        string side,
        uint256 stakeUnits,
        uint16 oddsBps,
        string uri,
        uint256 timestamp
    );

    event FeeBpsUpdated(uint16 newFeeBps);
    event TreasuryUpdated(address newTreasury);

    constructor(address _treasury, uint16 _feeBps, address _token) Ownable(msg.sender) {
        require(_treasury != address(0), "treasury");
        require(_feeBps <= 1000, "fee-too-high");
        require(_token != address(0), "token");
        treasury = _treasury;
        feeBps = _feeBps;
        token = IERC20(_token);
    }

    function setFeeBps(uint16 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "fee-too-high");
        feeBps = _feeBps;
        emit FeeBpsUpdated(_feeBps);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function placePredictionToken(
        uint256 marketId,
        string calldata side,
        uint256 stakeUnits,
        uint16 oddsBps,
        string calldata uri
    ) external whenNotPaused nonReentrant returns (bytes32 id) {
        uint256 fee = (stakeUnits * feeBps) / 10000;
        if (fee > 0) {
            bool ok = token.transferFrom(msg.sender, treasury, fee);
            require(ok, "fee-transfer-failed");
        }

        id = keccak256(
            abi.encodePacked(
                msg.sender,
                marketId,
                side,
                stakeUnits,
                oddsBps,
                uri,
                block.chainid,
                block.number
            )
        );

        predictions[id] = Prediction({
            user: msg.sender,
            marketId: marketId,
            side: side,
            stakeUnits: stakeUnits,
            oddsBps: oddsBps,
            uri: uri,
            timestamp: block.timestamp
        });

        emit PredictionPlaced(
            msg.sender,
            marketId,
            id,
            side,
            stakeUnits,
            oddsBps,
            uri,
            block.timestamp
        );
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}