pragma solidity ^0.4.24;

import "./DepositPlan.sol";


contract SilverDepositPlan is DepositPlan {
  constructor(IERC20 _bfclToken)
    DepositPlan(
      _bfclToken,
      15 days,
      3,
      10
    )
    public
  {
  }
}
