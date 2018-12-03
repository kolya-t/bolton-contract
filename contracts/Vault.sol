pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


contract Vault is Ownable {
  using SafeMath for uint;

  address public investor;
  IERC20 internal bfclToken;

  constructor (address _investor, IERC20 _bfclToken) public {
    investor = _investor;
    bfclToken = _bfclToken;
  }

  // reverts ETH transfers
  function () external {
    revert();
  }

  // reverts erc223 transfers
  function tokenFallback(address, uint, bytes) external pure {
    revert();
  }

  function withdrawToInvestor(uint _amount) external onlyOwner {
    bfclToken.transfer(investor, _amount);
  }

  function getBalance() external view returns (uint) {
    return bfclToken.balanceOf(investor);
  }
}
