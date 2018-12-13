pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./Whitelist.sol";
import "./Vault.sol";


contract DepositPlan is Ownable, ReentrancyGuard {
  using SafeMath for uint;

  event AddInvestor(address indexed _investor);
  event RemoveInvestor(address indexed _investor);

  IERC20 public bfclToken;
  Whitelist public whitelist;
  uint public depositPercentPerDay;
  uint public minInvestment;
  address public tokensWallet;

  mapping (address => Account) public accounts;

  struct Account {
    Vault vault;
    uint deposit;
    uint lastWithdrawTime;
    uint depositEndTime;
    uint debt;
    bool isClosed;
  }

  constructor(
    IERC20 _bfclToken,
    Whitelist _whitelist,
    uint _depositPercentPerDay, // ex. 10 for 0.10%, 16 for 0.16%
    uint _minInvestment, // 10000000000000000000 for 10 BFCL
    address _tokensWallet
  ) public {
    bfclToken = _bfclToken;
    whitelist = _whitelist;
    depositPercentPerDay = _depositPercentPerDay;
    minInvestment = _minInvestment;
    tokensWallet = _tokensWallet;
  }

  modifier onlyIfWhitelisted() {
    require(whitelist.isWhitelisted(msg.sender));
    _;
  }

  // reverts ETH transfers
  function () external {
    revert();
  }

  // reverts erc223 token transfers
  function tokenFallback(address, uint, bytes) external pure {
    revert();
  }

  function getAccountInfo(address _address)
    external
    view
    returns (address, uint, uint, uint, uint, bool)
  {
    Account storage account = accounts[_address];
    return (
      address(account.vault),
      account.deposit,
      account.lastWithdrawTime,
      account.depositEndTime,
      account.debt,
      account.isClosed
    );
  }

  function transferErc20(
    IERC20 _token,
    address _to,
    uint _value
  )
    external
    onlyOwner
  {
    _token.transfer(_to, _value);
  }

  function transferBfcl(
    address _to,
    uint _value
  )
    external
    onlyOwner
  {
    bfclToken.transfer(_to, _value);
  }

  function invest(uint _tokenAmount) external;

  function _invest(
    uint _tokenAmount,
    uint _depositEndTime
  ) internal {
    address investor = msg.sender;
    Account storage account = accounts[investor];

    if (account.vault != Vault(0)) {
      revert();
    }

    require(_tokenAmount >= minInvestment);
    require(bfclToken.allowance(investor, address(this)) >= _tokenAmount);

    account.vault = new Vault(investor, bfclToken);
    bfclToken.transferFrom(investor, account.vault, _tokenAmount);
    account.deposit = _tokenAmount;
    account.lastWithdrawTime = now;
    account.depositEndTime = _depositEndTime;

    emit AddInvestor(investor);
  }

  function airdrop(address[] _investors)
    external
    onlyOwner
    nonReentrant
  {
    for (uint i = 0; i < _investors.length; i++) {
      address investor = _investors[i];
      _sendPayouts(investor);
    }
  }

  function withdraw() external {
    address investor = msg.sender;
    Account storage account = accounts[investor];
    require(now >= account.depositEndTime);
    _sendPayouts(investor);
    account.vault.withdrawToInvestor(account.deposit);
    if (account.debt == 0) {
      delete accounts[investor];
      emit RemoveInvestor(investor);
    } else {
      account.isClosed = true;
    }
  }

  function getBalance()
    public
    view
    returns (uint)
  {
    uint balance = bfclToken.balanceOf(tokensWallet);
    uint allowance = bfclToken.allowance(tokensWallet, address(this));
    return balance < allowance ? balance : allowance;
  }

  function calculateInvestorPayoutsForTime(
    address _investor,
    uint _timestamp
  )
    external
    view
    returns (uint)
  {
    Account storage account = accounts[_investor];
    return _calculateAccountPayoutsForTime(account, _timestamp);
  }

  function calculatePayoutsForTime(
    address[] _investors,
    uint _timestamp
  )
    external
    view
    returns (uint)
  {
    uint payouts;
    for (uint i = 0; i < _investors.length; i++) {
      Account storage account = accounts[_investors[i]];
      payouts = payouts.add(_calculateAccountPayoutsForTime(account, _timestamp));
    }
    return payouts;
  }

  function _sendPayouts(address _investor) internal {
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
        bfclToken.transferFrom(tokensWallet, _investor, canPay);
      }
    }
  }

  function _calculateAccountPayoutsForTime(
    Account storage _account,
    uint _timestamp
  )
    internal
    view
    returns (uint)
  {
    uint period = _timestamp.sub(_account.lastWithdrawTime);
    return _calculateAccountPayoutsForPeriod(_account, period);
  }

  function _calculateAccountPayoutsForPeriod(
    Account storage _account,
    uint _period
  )
    internal
    view
    returns (uint)
  {
    uint dividends;
    if (!_account.isClosed) {
      dividends = _account.deposit.mul(_period).mul(depositPercentPerDay).div(10000).div(1 days);
    }
    return dividends.add(_account.debt);
  }
}
