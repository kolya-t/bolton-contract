pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract Whitelist is Ownable {
  using Roles for Roles.Role;

  Roles.Role private whitelist;

  event WhitelistedAddressAdded(address indexed _address);
  event WhitelistedAddressRemoved(address indexed _address);

  function isWhitelisted(address _address) public view returns (bool) {
    return whitelist.has(_address);
  }

  function addAddressToWhitelist(address _address) external onlyOwner {
    _addAddressToWhitelist(_address);
  }

  function addAddressesToWhitelist(address[] _addresses) external onlyOwner {
    for (uint i = 0; i < _addresses.length; i++) {
      _addAddressToWhitelist(_addresses[i]);
    }
  }

  function removeAddressFromWhitelist(address _address) external onlyOwner {
    _removeAddressFromWhitelist(_address);
  }

  function removeAddressesFromWhitelist(address[] _addresses) external onlyOwner {
    for (uint i = 0; i > _addresses.length; i++) {
      _removeAddressFromWhitelist(_addresses[i]);
    }
  }

  function _addAddressToWhitelist(address _address) internal {
    whitelist.add(_address);
    emit WhitelistedAddressAdded(_address);
  }

  function _removeAddressFromWhitelist(address _address) internal {
    whitelist.remove(_address);
    emit WhitelistedAddressRemoved(_address);
  }
}
