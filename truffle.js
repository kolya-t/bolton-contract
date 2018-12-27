const ganache = require('ganache-cli');
const BigNumber = require('bignumber.js');
const HDWalletProvider = require('truffle-hdwallet-provider-privkey');

BigNumber.config({ EXPONENTIAL_AT: 100 });

module.exports = {
    networks: {
        ganache: {
            network_id: '*', // eslint-disable-line camelcase
            provider: ganache.provider({
                total_accounts: 6, // eslint-disable-line camelcase
                default_balance_ether: BigNumber(1e+99), // eslint-disable-line camelcase
                mnemonic: 'mywish',
                time: new Date('2017-10-10T15:00:00Z'),
                debug: false,
                // ,logger: console
            }),
        },
        localhost: {
            host: 'localhost',
            port: 8545,
            network_id: '*', // eslint-disable-line camelcase
        },
        ropsten: {
            provider: () => new HDWalletProvider([
                "44EC2FB9856B1D1903B020FEF67E4A1177AAEDF862A4EB9254822FA96BF89B9C",
            ], "https://ropsten.infura.io/v3/c793163094d44d72928d61fbefe050f8"),
            network_id: 3
        },
        mainnet: {
            provider: () => new HDWalletProvider([
                "44EC2FB9856B1D1903B020FEF67E4A1177AAEDF862A4EB9254822FA96BF89B9C",
            ], "https://mainnet.infura.io/v3/c793163094d44d72928d61fbefe050f8"),
            network_id: 1
        }
    },
    solc: {
        optimizer: {
            enabled: true,
            runs: 200,
        },
    },
    network: 'mainnet',
    mocha: {
        bail: true,
        fullTrace: true,
    },
};
