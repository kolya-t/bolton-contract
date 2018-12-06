const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
chai.use(require('chai-bignumber')(web3.BigNumber));
chai.should();
const pify = require('pify');
const { timeTo, increaseTime, snapshot, revert } = require('sc-library/test-utils/evmMethods');
const { estimateConstructGas } = require('sc-library/test-utils/web3Utils');

const BigNumber = web3.BigNumber;

const Token = artifacts.require('./TestToken.sol')
const Whitelist = artifacts.require('./Whitelist.sol');
const Vault = artifacts.require('./Vault.sol');
const Silver = artifacts.require('./SilverDepositPlan.sol');
const Gold = artifacts.require('./GoldDepositPlan.sol');
const Platinum = artifacts.require('./PlatinumDepositPlan.sol');
const TryAndBuy = artifacts.require('./TryAndBuyDepositPlan.sol');

const DAY = 24 * 3600;
const gasPrice = 10 ** 11;

contract('DepositContract', accounts => {
	const OWNER = accounts[1]
	const INVESTORS = [accounts[2], accounts[3], accounts[4]];

	let snapshotId;

	const getBlockchainTimestamp = async () => {
        const latestBlock = await web3async(web3.eth, web3.eth.getBlock, 'latest');
        return latestBlock.timestamp;
    };

    const createDepositContracts = async () => {
    	const token = await Token.new();
    	const whitelist = await Whitelist.new(token.address);
    	const silverContract = await Silver.new(token.address, whitelist.address);
    	const goldContract = await Gold.new(token.address, whitelist.address);
    	const platinumContract = await Platinum.new(token.address, whitelist.address);
        const demoContract = await TryAndBuy.new(token.address, whitelist.address);
        return {
        	token: token,
        	whitelist: whitelist,
        	silver: silverContract,
        	gold: goldContract,
        	platinum: platinumContract,
        	demo: demoContract
        }
    }

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
    	    const whitelist = await Whitelist.new(token.address)
    	    await estimateConstructGas(Silver, OWNER, whitelist.address, token.address)
    	        .then(gas => console.info('      Silver contract construct gas:', gas));
    	    await estimateConstructGas(Gold, OWNER, whitelist.address, token.address)
    	        .then(gas => console.info('      Gold contract construct gas:', gas));
    	    await estimateConstructGas(Platinum, OWNER, whitelist.address, token.address)
    	        .then(gas => console.info('      Platinum contract construct gas:', gas));
    	    await estimateConstructGas(TryAndBuy, OWNER, whitelist.address, token.address)
    	        .then(gas => console.info('      Try and buy contract construct gas:', gas));
    	    await estimateConstructGas(Vault, OWNER, token.address)
    	        .then(gas => console.info('      Vault contract construct gas:', gas))
        })

        it('#1 create deposit contracts', async () => {
    	    const depositContracts = await createDepositContracts();
    	    depositContracts.token.address.should.have.length(42);
    	    depositContracts.whitelist.address.should.have.length(42);
    	    depositContracts.silver.address.should.have.length(42);
    	    depositContracts.gold.address.should.have.length(42);
    	    depositContracts.platinum.address.should.have.length(42);
    	    depositContracts.demo.address.should.have.length(42);
        })
    })

describe('Whitelist', async () =>{
	it('#1 check whitelist empty', async () => {
		const depositContracts = await createDepositContracts();
		const whitelist = depositContracts.whitelist;
		const INVESTOR = INVESTORS[0];
		const notWhitelisted = await whitelist.isWhitelisted(INVESTOR);
		notWhitelisted.should.be.false;
	})

	it('#2 check add to whitelist', async () => {
		const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        (await whitelist.isWhitelisted(INVESTORS[0])).should.be.false;
        await whitelist.addAddressToWhitelist(INVESTORS[0]);
        (await whitelist.isWhitelisted(INVESTORS[0])).should.be.true;
	})

	it('#3 check bulk add to whitelist', async () => {
		const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        (await whitelist.isWhitelisted(INVESTORS[0])).should.be.false;
        (await whitelist.isWhitelisted(INVESTORS[1])).should.be.false;
        (await whitelist.isWhitelisted(INVESTORS[2])).should.be.false;
        await whitelist.addAddressesToWhitelist(INVESTORS);
        (await whitelist.isWhitelisted(INVESTORS[0])).should.be.true;
        (await whitelist.isWhitelisted(INVESTORS[1])).should.be.true;
        (await whitelist.isWhitelisted(INVESTORS[2])).should.be.true;
	})

	it('#4 check remove from whitelist', async () => {
		const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        await whitelist.addAddressToWhitelist(INVESTORS[0]);
        (await whitelist.isWhitelisted(INVESTORS[0])).should.be.true;
        await whitelist.removeAddressFromWhitelist(INVESTORS[0]);
        (await whitelist.isWhitelisted(INVESTORS[0])).should.be.false;
	})

    /*
	it('#5 check bulk remove from whitelist', async () => {
		const depositContracts = await createDepositContracts();
        const whitelist = depositContracts.whitelist;
        await whitelist.addAddressesToWhitelist(INVESTORS);
        (await whitelist.isWhitelisted(INVESTORS[0])).should.be.true;
        (await whitelist.isWhitelisted(INVESTORS[1])).should.be.true;
        (await whitelist.isWhitelisted(INVESTORS[2])).should.be.true;
        await whitelist.removeAddressesFromWhitelist(INVESTORS, {from: OWNER});

  
        //(await whitelist.isWhitelisted(INVESTORS[0])).should.be.false;
        //(await whitelist.isWhitelisted(INVESTORS[1])).should.be.false;
        //(await whitelist.isWhitelisted(INVESTORS[2])).should.be.false;
        console.log(INVESTORS[1]);
        console.log(await whitelist.isWhitelisted(INVESTORS[1]));
	})
	*/
})

describe('Vault tests', async () =>{
	it('#1 check accept tokens', async () => {
		const token = await Token.new()
		const vault = await Vault.new(OWNER, token.address)
	})
})

});