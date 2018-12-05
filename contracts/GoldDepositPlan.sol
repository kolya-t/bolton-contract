pragma solidity ^0.4.24;

import "./MetalDepositPlan.sol";


contract GoldDepositPlan is MetalDepositPlan {
  constructor(
    IERC20 _bfclToken,
    Whitelist _whitelist
  )
    MetalDepositPlan(
      _bfclToken,
      _whitelist,
      365 days,
      10,
      500000000000000000000
    )
    public
  {
  }
}
