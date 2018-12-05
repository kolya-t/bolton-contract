const Token = artifacts.require('./TestToken.sol');
const Silver = artifacts.require('./SilverDepositPlan.sol');

module.exports = function (deployer, network, accounts) {
    deployer.deploy(Token)
        .then(token => {
            return deployer.deploy(Silver, token.address);
        });
};
