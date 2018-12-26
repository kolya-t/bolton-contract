pragma solidity ^0.4.24;

import "./DepositPlan.sol";


contract MetalDepositPlan is DepositPlan {
  uint public depositTime;
  uint public constant minReplenishment = 240000000000000000000;

  constructor(
    IERC20 _bfclToken,
    Whitelist _whitelist,
    uint _depositTime,
    uint _depositPercentPerDay,
    uint _minInvestment,
    address _tokensWallet
  )
    DepositPlan(
      _bfclToken,
      _whitelist,
      _depositPercentPerDay,
      _minInvestment,
      _tokensWallet
    )
    public
  {
    depositTime = _depositTime;
  }

  function invest(uint _tokenAmount)
    external
    nonReentrant
    onlyIfWhitelisted
  {
    _invest(_tokenAmount, now.add(depositTime));
  }

  function replenish(uint _tokenAmount)
    external
    nonReentrant
    onlyIfWhitelisted
  {
    address investor = msg.sender;
    Account storage account = accounts[investor];

    if (account.vault == Vault(0)) {
      revert();
    }

    require(_tokenAmount >= minReplenishment);

    _sendPayouts(investor);
    bfclToken.transferFrom(investor, account.vault, _tokenAmount);
    account.deposit = account.deposit.add(_tokenAmount);

    if (now >= account.depositEndTime) {
      account.depositEndTime = now.add(depositTime);
    }

    if (account.isClosed) {
      account.isClosed = false;
    }
  }
}
