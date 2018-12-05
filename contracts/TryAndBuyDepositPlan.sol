pragma solidity ^0.4.24;

import "./DepositPlan.sol";


contract TryAndBuyDepositPlan is DepositPlan {
  uint public constant maxInvestment = 1000000000000000000000; // 1000 BFCL
  uint public constant startTime = 1546300800; // Jan 01 2019 00:00:00 UTC
  uint public constant stopTime = 1548979199; // Jan 31 2019 23:59:59 UTC

  constructor(IERC20 _bfclToken)
    DepositPlan(
      _bfclToken,
      3,
      10000000000000000000
    )
    public
  {
  }

  function invest(uint _tokenAmount)
    external
    nonReentrant
    onlyIfWhitelisted
  {
    require(now >= startTime);
    require(now <= stopTime);
    _invest(_tokenAmount, stopTime);
  }

  function _calculateAccountPayoutsForTime(
    Account storage _account,
    uint _timestamp
  )
    internal
    view
    returns (uint)
  {
    _timestamp = _timestamp < stopTime ? _timestamp : stopTime;
    uint period = _timestamp.sub(_account.lastWithdrawTime);
    return _calculateAccountPayoutsForPeriod(_account, period);
  }
}