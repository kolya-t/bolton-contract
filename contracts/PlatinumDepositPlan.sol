pragma solidity ^0.4.24;

import "./DepositPlan.sol";


contract PlatinumDepositPlan is DepositPlan {
  constructor(IERC20 _bfclToken)
    DepositPlan(
      _bfclToken,
      730 days,
      16,
      5000000000000000000000
    )
    public
  {
  }
}
