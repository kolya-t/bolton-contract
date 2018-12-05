pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "./Vault.sol";


contract DepositPlan is Ownable, ReentrancyGuard {
  using SafeMath for uint;

  IERC20 public bfclToken;
  uint public depositTime;
  uint public depositPercentPerDay;
  uint public minInvestment;

  mapping (address => Account) public accounts;

  struct Account {
    Vault vault;
    uint deposit;
    uint lastWithdrawTime;
    uint depositEndTime;
    uint debt;
  }

  constructor(
    IERC20 _bfclToken,
    uint _depositTime, // ex. 15 days or 1 year
    uint _depositPercentPerDay, // ex. 10 for 0.10%, 16 for 0.16%
    uint _minInvestment // 10000000000000000000 for 10 BFCL
  ) public {
    bfclToken = _bfclToken;
    depositTime = _depositTime;
    depositPercentPerDay = _depositPercentPerDay;
    minInvestment = _minInvestment;
  }

  // reverts ETH transfers
  function () external {
    revert();
  }

  // reverts erc223 transfers
  function tokenFallback(address, uint, bytes) external pure {
    revert();
  }

  function invest(uint _tokenAmount) external nonReentrant {
    address investor = msg.sender;
    Account storage account = accounts[investor];

    if (account.vault == Vault(0)) {
      require(_tokenAmount >= minInvestment);
      require(bfclToken.allowance(investor, address(this)) >= _tokenAmount);

      account.vault = new Vault(investor, bfclToken);
      bfclToken.transferFrom(investor, account.vault, _tokenAmount);
      account.deposit = _tokenAmount;
      account.lastWithdrawTime = now;
      account.depositEndTime = now + depositTime;
    } else {
      _sendDividends(investor);
      account.deposit = account.deposit.add(_tokenAmount);
    }
  }

  function airdrop(address[] _investors) external onlyOwner nonReentrant {
    for (uint i = 0; i < _investors.length; i++) {
      address investor = _investors[i];
      _sendDividends(investor);
    }
  }

  function withdraw() external {
    address investor = msg.sender;
    Account storage account = accounts[investor];
    require(now >= account.depositEndTime);
    _sendDividends(investor);
    delete accounts[investor];
  }

  function getBalance() public view returns (uint) {
    return bfclToken.balanceOf(address(this));
  }

  function calculateInvestorPayoutsForTime(address _investor, uint _timestamp) external view returns (uint) {
    Account storage account = accounts[_investor];
    return _calculateAccountPayoutsForTime(account, _timestamp);
  }

  function calculatePayoutsForTime(address[] _investors, uint _timestamp) external view returns (uint) {
    uint payouts;
    for (uint i = 0; i < _investors.length; i++) {
      Account storage account = accounts[_investors[i]];
      payouts = payouts.add(_calculateAccountPayoutsForTime(account, _timestamp));
    }
  }

  function _sendDividends(address _investor) internal {
    Account storage account = accounts[_investor];
    uint mustPay = _calculateAccountPayoutsForTime(account, now);
    account.lastWithdrawTime = now;

    if (mustPay > 0) {
      uint balance = getBalance();
      uint canPay;

      if (balance >= mustPay) {
        account.debt = 0;
        canPay = mustPay;
      } else {
        account.debt = mustPay.sub(balance);
        canPay = balance;
      }

      if (canPay > 0) {
        bfclToken.transfer(_investor, balance);
      }
    }
  }

  function _calculateAccountPayoutsForTime(Account storage _account, uint _timestamp) internal view returns (uint) {
    uint sec = _timestamp - _account.lastWithdrawTime;
    uint percentPerSecond = depositPercentPerDay * 1 days;
    uint dividends = _account.deposit.mul(sec).mul(percentPerSecond).div(10000);
    return dividends.add(_account.debt);
  }
}
