const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.use(require('chai-bignumber')(web3.BigNumber));
chai.should();
const pify = require('pify');
const { timeTo, increaseTime, snapshot, revert } = require('sc-library/test-utils/evmMethods');
const { estimateConstructGas } = require('sc-library/test-utils/web3Utils');
const truffleAssert  = require('truffle-assertions');

const BigNumber = web3.BigNumber;

const Token = artifacts.require('./TestToken.sol');
const Whitelist = artifacts.require('./Whitelist.sol');
const Vault = artifacts.require('./Vault.sol');
const Silver = artifacts.require('./SilverDepositPlan.sol');
const Gold = artifacts.require('./GoldDepositPlan.sol');
const Platinum = artifacts.require('./PlatinumDepositPlan.sol');
const TryAndBuy = artifacts.require('./TryAndBuyDepositPlan.sol');

const DAY = 24 * 3600;
const gasPrice = 10 ** 11;
const DECIMALS = 10 ** 18;
const tokenSupply = (10 ** 9 ) * DECIMALS;
const simpleAmount = tokenSupply / 10;
const userAmount = simpleAmount / 2;
const tokenSupplyBN = new BigNumber(tokenSupply);
const simpleBN = new BigNumber(simpleAmount);
const userAmountBN = new BigNumber(userAmount);



contract('DepositContract', accounts => {
    const OWNER = accounts[1];
    const INVESTORS = [accounts[2], accounts[3], accounts[4]];
    const INVESTOR_1 = accounts[2];

    let snapshotId;

    const getBlockchainTimestamp = async () => {
        const latestBlock = await web3async(web3.eth, web3.eth.getBlock, 'latest');
        return latestBlock.timestamp;
    };

    const createDepositContracts = async () => {
        const token = await Token.new({from: OWNER});
        const whitelist = await Whitelist.new(token.address, {from: OWNER});
        const silverContract = await Silver.new(token.address, whitelist.address, {from: OWNER});
        const goldContract = await Gold.new(token.address, whitelist.address, {from: OWNER});
        const platinumContract = await Platinum.new(token.address, whitelist.address, {from: OWNER});
        const demoContract = await TryAndBuy.new(token.address, whitelist.address, {from: OWNER});
        
        await token.mint(OWNER, tokenSupply, {from: OWNER}).should.be.fulfilled;
        await token.approve(silverContract.address, tokenSupply, {from: OWNER})
            .should.be.fulfilled;
        tokenSupplyBN.should.be.bignumber.equals(await token.allowance(OWNER, silverContract.address));
        for (let i = 0; i < INVESTORS.length; i++) {
            await token.mint(INVESTORS[i], simpleAmount, {from: OWNER}).should.be.fulfilled
            simpleBN.should.be.bignumber.equals(await token.balanceOf(INVESTORS[i]));
        }
        return {
            token: token,
            whitelist: whitelist,
            silver: silverContract,
            gold: goldContract,
            platinum: platinumContract,
            demo: demoContract,
            initialSupply: Number(await token.totalSupply()),
        };
    };

    beforeEach(async () => {
        snapshotId = (await snapshot()).result;
        const block = await pify(web3.eth.getBlock)('latest');
        now = block.timestamp;
    });

    afterEach(async () => {
        await revert(snapshotId);
    });

    describe('Precheck', async () => {
        it('#0 gas limit', async () => {
            const token = await Token.new();
            await estimateConstructGas(Whitelist, OWNER, token.address)
                .then(gas => console.info('      Whitelist construct gas:', gas));
            const whitelist = await Whitelist.new(token.address);
            await estimateConstructGas(Silver, OWNER, whitelist.address, token.address)
                .then(gas => console.info('      Silver contract construct gas:', gas));
            await estimateConstructGas(Gold, OWNER, whitelist.address, token.address)
                .then(gas => console.info('      Gold contract construct gas:', gas));
            await estimateConstructGas(Platinum, OWNER, whitelist.address, token.address)
                .then(gas => console.info('      Platinum contract construct gas:', gas));
            await estimateConstructGas(TryAndBuy, OWNER, whitelist.address, token.address)
                .then(gas => console.info('      Try and buy contract construct gas:', gas));
            await estimateConstructGas(Vault, OWNER, token.address)
                .then(gas => console.info('      Vault contract construct gas:', gas));
        });

        it('#1 create deposit contracts', async () => {
            const token = await Token.new({from: OWNER});
            const depositContracts = await createDepositContracts();
            depositContracts.token.address.should.have.length(42);
            depositContracts.whitelist.address.should.have.length(42);
            depositContracts.silver.address.should.have.length(42);
            depositContracts.gold.address.should.have.length(42);
            depositContracts.platinum.address.should.have.length(42);
            depositContracts.demo.address.should.have.length(42);
        });
    });

describe('Whitelist', async () =>{
    it('#1 check whitelist empty', async () => {
        const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        const notWhitelisted = await whitelist.isWhitelisted(INVESTOR_1);
        notWhitelisted.should.be.false;
    });

    it('#2 check add to whitelist', async () => {
        const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        (await whitelist.isWhitelisted(INVESTOR_1)).should.be.false;
        await whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER});
        (await whitelist.isWhitelisted(INVESTOR_1)).should.be.true;
    });

    it('#3 check bulk add to whitelist', async () => {
        const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        for (let i = 0; i < INVESTORS.length; i++) {
            (await whitelist.isWhitelisted(INVESTORS[i])).should.be.false;
        }
        await whitelist.addAddressesToWhitelist(INVESTORS, {from: OWNER});
        for (let i = 0; i < INVESTORS.length; i++) {
            (await whitelist.isWhitelisted(INVESTORS[i])).should.be.true;
        }
    });

    it('#4 check remove from whitelist', async () => {
        const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        await whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER});
        (await whitelist.isWhitelisted(INVESTOR_1)).should.be.true;
        await whitelist.removeAddressFromWhitelist(INVESTOR_1, {from: OWNER});
        (await whitelist.isWhitelisted(INVESTOR_1)).should.be.false;
    });

    it('#5 check bulk remove from whitelist', async () => {
        const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        await whitelist.addAddressesToWhitelist(INVESTORS, {from: OWNER});
        for (let i = 0; i < INVESTORS.length; i++) {
            (await whitelist.isWhitelisted(INVESTORS[i])).should.be.true;
        }
        await whitelist.removeAddressesFromWhitelist(INVESTORS, {from: OWNER});
        for (let i = 0; i < INVESTORS.length; i++) {
            (await whitelist.isWhitelisted(INVESTORS[i])).should.be.false;
        }
    });

    it('#6 check add events', async () => {
        const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        const txAdd = await whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        truffleAssert.eventEmitted(txAdd, 'WhitelistedAddressAdded', (ev) => {
            return ev._address.should.be.equals(INVESTOR_1);
        });
        truffleAssert.prettyPrintEmittedEvents(txAdd);
    });

    it('#7 check remove events', async () => {
        const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        await whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        const txRemove = await whitelist.removeAddressFromWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        truffleAssert.eventEmitted(txRemove, 'WhitelistedAddressRemoved', (ev) => {
            return ev._address.should.be.equals(INVESTOR_1);
        });
        truffleAssert.prettyPrintEmittedEvents(txRemove);
    });

    it('#8 check cannot be added twice', async () => {
        const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        await whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        await whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.not.be.fulfilled;
    });

    it('#9 check cannot be removed twice', async () => {
        const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        const INVESTOR_1 = INVESTORS[0];
        await whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        await whitelist.removeAddressFromWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        await whitelist.removeAddressFromWhitelist(INVESTOR_1, {from: OWNER}).should.not.be.fulfilled;
    });
});

describe('Vault tests', async () =>{
    it('#0 check construct', async () => {
        const token = await Token.new(OWNER);
        const vault = await Vault.new(OWNER, token.address);
        (await vault.investor()).should.be.equals(OWNER);
    })
    
    it('#1 check simple accept tokens', async () => {
        const token = await Token.new(OWNER);
        const vault = await Vault.new(OWNER, token.address);
        await token.mint(OWNER, simpleAmount).should.be.fulfilled;
        await token.transfer(vault.address, simpleAmount, {from: OWNER}).should.be.fulfilled;

        const balance = await vault.getBalance();
        console.log(balance);
        const vaultBalance = await token.balanceOf(vault.address);
        console.log(vaultBalance);
    });

    /*
    it('#1 check transfer tokens from vault', async () => {
        const token = await Token.new(OWNER);
        const vault = await Vault.new(OWNER, token.address);
        await token.mint(OWNER, simpleAmount).should.be.fulfilled;
        await token.transfer(vault.address, simpleAmount, {from: OWNER}).should.be.fulfilled;
        await vault.withdrawToInvestor(simpleAmount, {from: OWNER}).should.be.fulfilled;
        console.log(await token.balanceOf(OWNER));
    });
    */
});

describe('Payment tests', async () =>{
    it('#1 check simple deposit', async () => {
    const depositContracts = await createDepositContracts();
        await depositContracts.token.approve(depositContracts.silver.address, simpleAmount, {from: INVESTOR_1})
            .should.be.fulfilled;
        await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        await depositContracts.silver.invest(userAmount, {from: INVESTOR_1}).should.be.fulfilled;
        const balanceBefore = await depositContracts.token.balanceOf(INVESTOR_1);
        console.log(balanceBefore);
        await depositContracts.silver.replenish(userAmount, {from: INVESTOR_1}).should.be.fulfilled;
        const balanceAfter = await depositContracts.token.balanceOf(INVESTOR_1);
        console.log(balanceAfter);
        //userAmountBN.should.be.bignumber.equals(new BigNumber(balanceBefore - balanceAfter));
        const accountInfo = await depositContracts.silver.getAccountInfo(INVESTOR_1);
        console.log(accountInfo);
     })
});

});
