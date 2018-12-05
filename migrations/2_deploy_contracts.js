const Token = artifacts.require('./TestToken.sol');
const Silver = artifacts.require('./SilverDepositPlan.sol');
const Gold = artifacts.require('./GoldDepositPlan.sol');
const Platinum = artifacts.require('./PlatinumDepositPlan.sol');
const TryAndBuy = artifacts.require('./TryAndBuyDepositPlan.sol');

module.exports = function (deployer, network, accounts) {
    deployer.deploy(Token)
        .then(token => deployer.deploy(Silver, token.address))
        .then(token => deployer.deploy(Gold, token.address))
        .then(token => deployer.deploy(Platinum, token.address))
        .then(token => deployer.deploy(TryAndBuy, token.address));
};
