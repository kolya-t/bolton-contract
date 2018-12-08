const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.use(require('chai-bignumber')(web3.BigNumber));
chai.should();
const pify = require('pify');
const { timeTo, increaseTime, snapshot, revert } = require('sc-library/test-utils/evmMethods');
const { web3async, estimateConstructGas } = require('sc-library/test-utils/web3Utils');
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
const ETH = web3.toWei(1, 'ether');
const DECIMALS = 10 ** 18;
const tokenSupply = (10 ** 9 ) * DECIMALS;
const simpleAmount = tokenSupply / 10;
const userAmount = simpleAmount / 2;
const tokenSupplyBN = new BigNumber(tokenSupply);
const simpleAmountBN = new BigNumber(simpleAmount);
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
        await token.transfer(silverContract.address, tokenSupply, {from: OWNER})
            .should.be.fulfilled;
        tokenSupplyBN.should.be.bignumber.equals(await token.balanceOf(silverContract.address));
        for (let i = 0; i < INVESTORS.length; i++) {
            await token.mint(INVESTORS[i], simpleAmount, {from: OWNER}).should.be.fulfilled
            simpleAmountBN.should.be.bignumber.equals(await token.balanceOf(INVESTORS[i]));
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
        const token = await Token.new(OWNER, {from: OWNER});
        const vault = await Vault.new(OWNER, token.address, {from: OWNER});
        (await vault.investor()).should.be.equals(OWNER);
    })
    
    it('#1 check vault accept tokens', async () => {
        const token = await Token.new(OWNER, {from: OWNER});
        const vault = await Vault.new(OWNER, token.address, {from: OWNER});
        await token.mint(OWNER, simpleAmount, {from: OWNER}).should.be.fulfilled;
        await token.transfer(vault.address, simpleAmount, {from: OWNER}).should.be.fulfilled;
        const vaultBalance = await token.balanceOf(vault.address);
        vaultBalance.should.be.bignumber.equals(simpleAmountBN);
    });

    it('#2 check vault shows balance', async () => {
        const token = await Token.new(OWNER, {from: OWNER});
        const vault = await Vault.new(OWNER, token.address, {from: OWNER});
        await token.mint(OWNER, simpleAmount, {from: OWNER}).should.be.fulfilled;
        await token.transfer(vault.address, simpleAmount, {from: OWNER}).should.be.fulfilled;
        const vaultBalance = await token.balanceOf(vault.address);
        vaultBalance.should.be.bignumber.equals(simpleAmountBN);

        const vaultInternalBalance = await vault.getBalance();
        console.log(vaultInternalBalance);
    });

    it('#3 check vault rejects ETH', async () => {
        const token = await Token.new(OWNER, {from: OWNER});
        const vault = await Vault.new(OWNER, token.address, {from: OWNER});
        await token.mint(OWNER, simpleAmount, {from: OWNER}).should.be.fulfilled;
        await vault.sendTransaction({from: OWNER, value: ETH}).should.be.rejected;
    });

    it('#4 check vault can return tokens back', async () => {
        const token = await Token.new(OWNER, {from: OWNER});
        const vault = await Vault.new(OWNER, token.address, {from: OWNER});
        await token.mint(OWNER, simpleAmount, {from: OWNER}).should.be.fulfilled;
        await token.transfer(vault.address, simpleAmount, {from: OWNER}).should.be.fulfilled;
        await vault.withdrawToInvestor(simpleAmount, {from: OWNER}).should.be.fulfilled;
        const userBalanceAfter = await token.balanceOf(OWNER);
        userBalanceAfter.should.be.bignumber.equals(simpleAmountBN);
    });

    it('#5 check vault created and received tokens from deposit', async () => {
        const depositContracts = await createDepositContracts();
        await depositContracts.token.approve(depositContracts.silver.address, simpleAmount, {from: INVESTOR_1})
            .should.be.fulfilled;
        await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        await depositContracts.silver.invest(userAmount, {from: INVESTOR_1}).should.be.fulfilled;
        const accountInfo = await depositContracts.silver.getAccountInfo(INVESTOR_1);
        accountInfo[0].should.have.length(42);
        const vaultBalanceAfter = await depositContracts.token.balanceOf(accountInfo[0]);
        vaultBalanceAfter.should.be.bignumber.equals(userAmountBN);
    });
});

describe('Account creation and deposit tests', async () =>{
    it('#1 check simple deposit', async () => {
        const depositContracts = await createDepositContracts();
        await depositContracts.token.approve(depositContracts.silver.address, simpleAmount, {from: INVESTOR_1})
            .should.be.fulfilled;
        await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        const userBalanceBefore = await depositContracts.token.balanceOf(INVESTOR_1);
        await depositContracts.silver.invest(userAmount, {from: INVESTOR_1}).should.be.fulfilled;
        const userBalanceAfter = await depositContracts.token.balanceOf(INVESTOR_1);
        userAmountBN.should.be.bignumber.equals(userBalanceBefore - userBalanceAfter);
        const accountInfo = await depositContracts.silver.getAccountInfo(INVESTOR_1);
        const vaultBalanceAfter = await depositContracts.token.balanceOf(accountInfo[0]);
        vaultBalanceAfter.should.be.bignumber.equals(userAmountBN);
    });

    it('#2 check reverts if allowance is not enough', async () => {
        const depositContracts = await createDepositContracts();
        await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        await depositContracts.token.approve(depositContracts.silver.address, simpleAmount / 100, {from: INVESTOR_1})
            .should.be.fulfilled;
        await depositContracts.silver.invest(userAmount, {from: INVESTOR_1}).should.not.be.fulfilled;
    });

    it('#3 check reverts if amount is less than minimal', async () => {
        const depositContracts = await createDepositContracts();
        const minAmount = depositContracts.silver.minInvestment();
        await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        await depositContracts.token.approve(depositContracts.silver.address, simpleAmount, {from: INVESTOR_1})
            .should.be.fulfilled;
        await depositContracts.silver.invest(minAmount / 100, {from: INVESTOR_1}).should.not.be.fulfilled;
    });

    it('#4 check reverts if invest called twice', async () => {
        const depositContracts = await createDepositContracts();
        await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        await depositContracts.token.approve(depositContracts.silver.address, simpleAmount, {from: INVESTOR_1})
            .should.be.fulfilled;
        await depositContracts.silver.invest(simpleAmount / 3, {from: INVESTOR_1}).should.be.fulfilled;
        await depositContracts.silver.invest(simpleAmount / 3, {from: INVESTOR_1}).should.not.be.fulfilled;

    });    

    it('#5 check time is tracking', async () => {
        const depositContracts = await createDepositContracts();
        const contract = depositContracts.silver
        await depositContracts.token.approve(contract.address, simpleAmount, {from: INVESTOR_1})
            .should.be.fulfilled;
        await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        const currentTime = await getBlockchainTimestamp();
        const contractTime = await contract.depositTime();

        await contract.invest(userAmount, {from: INVESTOR_1}).should.be.fulfilled;
        const accountInfo = await contract.getAccountInfo(INVESTOR_1);
        const lastWithdrawTime = accountInfo[2];
        const userEndTime = accountInfo[3];
        Number(lastWithdrawTime).should.be.closeTo(currentTime, 10);
        Number(userEndTime).should.be.closeTo(currentTime + Number(contractTime), 10)
    });
});
describe('Replenish tests', async () =>{
it('#1 check replenish', async () => {
        const depositContracts = await createDepositContracts();
        await depositContracts.token.approve(depositContracts.silver.address, simpleAmount, {from: INVESTOR_1})
            .should.be.fulfilled;
        await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
        await depositContracts.silver.invest(userAmount, {from: INVESTOR_1}).should.be.fulfilled;

        const accountInfo = await depositContracts.silver.getAccountInfo(INVESTOR_1);
        const accountDeposit = accountInfo[1];        
        const vaultBalance = await depositContracts.token.balanceOf(accountInfo[0]);
        const userBalance = await depositContracts.token.balanceOf(INVESTOR_1);
        const contractBalance = await depositContracts.token.balanceOf(depositContracts.silver.address);
        console.log("Before:");
        console.info("account info:");
        console.info(accountInfo);
        console.info("user balance:");
        console.info(userBalance);
        console.info("vault balance:");
        console.log(vaultBalance);
        console.log("deposit contract balance");
        console.log(contractBalance);
        
        const currentTime = await getBlockchainTimestamp();
        await timeTo(currentTime + DAY);

        await depositContracts.silver.replenish(userAmount, {from: INVESTOR_1}).should.be.fulfilled;

        
        const userBalanceReplenished = await depositContracts.token.balanceOf(INVESTOR_1);
        //userBalanceReplenished.should.be.bignumber.equals(userBalance - userAmountBN);
        const accountInfoReplenished = await depositContracts.silver.getAccountInfo(INVESTOR_1);
        const accountDepositReplenished = accountInfoReplenished[1];
        //accountDepositReplenished.should.be.bignumber.equals(accountInfoBN + userAmountBN);
        const vaultBalanceReplenished = await depositContracts.token.balanceOf(accountInfo[0]);
        //vaultBalanceReplenished.should.be.bignumber.equals(vaultBalance + userAmountBN);
        const contractBalanceReplenished = await depositContracts.token.balanceOf(depositContracts.silver.address);
        console.log("After:");
        console.info("account info:");
        console.info(accountInfoReplenished);
        console.info("user balance:");
        console.log(userBalanceReplenished);
        console.info("vault balance:");
        console.log(vaultBalanceReplenished);
        console.log("deposit contract balance:");
        console.log(contractBalanceReplenished);
    });
});
});
