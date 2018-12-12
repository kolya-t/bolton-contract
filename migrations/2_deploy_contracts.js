const Token = artifacts.require('./TestToken.sol');
const Whitelist = artifacts.require('./Whitelist.sol');
const Silver = artifacts.require('./SilverDepositPlan.sol');
const Gold = artifacts.require('./GoldDepositPlan.sol');
const Platinum = artifacts.require('./PlatinumDepositPlan.sol');
const TryAndBuy = artifacts.require('./TryAndBuyDepositPlan.sol');

module.exports = function (deployer, network, accounts) {
    deployer.deploy(Token)
        .then(token => deployer.deploy(Whitelist, token.address)
            .then(whitelist => deployer.deploy(Silver, token.address, whitelist.address, accounts[0])
                .then(_ => whitelist))
            .then(whitelist => deployer.deploy(Gold, token.address, whitelist.address, accounts[0])
                .then(_ => whitelist))
            .then(whitelist => deployer.deploy(Platinum, token.address, whitelist.address, accounts[0])
                .then(_ => whitelist))
            .then(whitelist => deployer.deploy(TryAndBuy, token.address, whitelist.address, accounts[0])))
};
