pragma solidity ^0.4.24;

import "./MetalDepositPlan.sol";


contract SilverDepositPlan is MetalDepositPlan {
  constructor(IERC20 _bfclToken)
    MetalDepositPlan(
      _bfclToken,
      15 days,
      3,
      10000000000000000000
    )
    public
  {
  }
}
