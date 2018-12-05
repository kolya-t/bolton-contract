pragma solidity ^0.4.24;

import "./DepositPlan.sol";


contract GoldDepositPlan is DepositPlan {
  constructor(IERC20 _bfclToken)
    DepositPlan(
      _bfclToken,
      365 days,
      10,
      500000000000000000000
    )
    public
  {
  }
}
