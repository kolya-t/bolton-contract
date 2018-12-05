pragma solidity ^0.4.24;

import "./MetalDepositPlan.sol";


contract PlatinumDepositPlan is MetalDepositPlan {
  constructor(IERC20 _bfclToken)
    MetalDepositPlan(
      _bfclToken,
      730 days,
      16,
      5000000000000000000000
    )
    public
  {
  }
}
