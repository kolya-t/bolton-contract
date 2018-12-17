// const Token = artifacts.require('./TestToken.sol');
const MetalWhitelist = artifacts.require('./MetalWhitelist.sol');
const TryAndBuyWhitelist = artifacts.require('./TryAndBuyWhitelist.sol');
const Silver = artifacts.require('./SilverDepositPlan.sol');
const Gold = artifacts.require('./GoldDepositPlan.sol');
const Platinum = artifacts.require('./PlatinumDepositPlan.sol');
const TryAndBuy = artifacts.require('./TryAndBuyDepositPlan.sol');

module.exports = function (deployer, network, accounts) {
    const token = {address: '0x1acd824d94cae446520dc8e45559c2970acdf452'};

    deployer.deploy(MetalWhitelist).then(whitelist => {
        return deployer.deploy(Silver, token.address, whitelist.address, accounts[0])
            .then(_ => deployer.deploy(Gold, token.address, whitelist.address, accounts[0]))
            .then(_ => deployer.deploy(Platinum, token.address, whitelist.address, accounts[0]));
    }).then(_ => {
        return deployer.deploy(TryAndBuyWhitelist)
            .then(whitelist => deployer.deploy(TryAndBuy, token.address, whitelist.address, accounts[0]));
    })
};
