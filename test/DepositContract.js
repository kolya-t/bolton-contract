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
const SILVER_TIME = DAY * 15;
const GOLD_TIME = DAY * 365;
const PLATINUM_TIME = DAY * 720
const TRY_AND_BUY_START = 1547510400;
const TRY_AND_BUY_END = 1552608000;
const TRY_AND_BUY_TIME = TRY_AND_BUY_END - TRY_AND_BUY_START;

const gasPrice = 10 ** 11;
const ETH = web3.toWei(1, 'ether');
const DECIMALS = 10 ** 18;
const tokenSupply = (10 ** 12 ) * DECIMALS;
const simpleAmount = (10 ** 6) * DECIMALS;
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

    const createDepositContracts = async (_contractPlan) => {
        const token = await Token.new({from: OWNER});
        const whitelist = await Whitelist.new(token.address, {from: OWNER});
        const silverContract = await Silver.new(token.address, whitelist.address, {from: OWNER});
        const goldContract = await Gold.new(token.address, whitelist.address, {from: OWNER});
        const platinumContract = await Platinum.new(token.address, whitelist.address, {from: OWNER});
        const demoContract = await TryAndBuy.new(token.address, whitelist.address, {from: OWNER});

        await token.mint(OWNER, 4 * tokenSupply, {from: OWNER}).should.be.fulfilled;
        await token.transfer(silverContract.address, tokenSupply, {from: OWNER})
            .should.be.fulfilled;
        await token.transfer(goldContract.address, tokenSupply, {from: OWNER})
            .should.be.fulfilled;
        await token.transfer(platinumContract.address, tokenSupply, {from: OWNER})
            .should.be.fulfilled;
        await token.transfer(demoContract.address, tokenSupply, {from: OWNER})
            .should.be.fulfilled;
        tokenSupplyBN.should.be.bignumber.equals(await token.balanceOf(silverContract.address));
        tokenSupplyBN.should.be.bignumber.equals(await token.balanceOf(goldContract.address));
        tokenSupplyBN.should.be.bignumber.equals(await token.balanceOf(platinumContract.address));
        tokenSupplyBN.should.be.bignumber.equals(await token.balanceOf(demoContract.address));
        for (let i = 0; i < INVESTORS.length; i++) {
            await token.mint(INVESTORS[i], simpleAmount, {from: OWNER}).should.be.fulfilled
            simpleAmountBN.should.be.bignumber.equals(await token.balanceOf(INVESTORS[i]));
        };

        let testingContract;

        if (_contractPlan == "silver") {
            testingContract = silverContract;
        } else if (_contractPlan == "gold") {
            testingContract = goldContract;
        } else if (_contractPlan == "platinum") {
            testingContract = platinumContract;
        } else if (_contractPlan == "demo") {
            await timeTo(TRY_AND_BUY_START);
            testingContract = demoContract;
        }

        return {
            token: token,
            whitelist: whitelist,
            silver: silverContract,
            gold: goldContract,
            platinum: platinumContract,
            mainContract: testingContract,
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
            //truffleAssert.prettyPrintEmittedEvents(txAdd);
        });

        it('#7 check remove events', async () => {
            const depositContracts = await createDepositContracts();
            const whitelist = depositContracts.whitelist;
            await whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
            const txRemove = await whitelist.removeAddressFromWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
            truffleAssert.eventEmitted(txRemove, 'WhitelistedAddressRemoved', (ev) => {
                return ev._address.should.be.equals(INVESTOR_1);
            });
            //truffleAssert.prettyPrintEmittedEvents(txRemove);
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

    describe('Vault', async () =>{
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
            vaultInternalBalance.should.be.bignumber.equals(simpleAmountBN);
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
    });
    

    //function depositContractTests(_contractPlan) {
    const depositContractTests = async (_contractPlan) => {
        
        describe('Account creation and deposit', async () =>{
            it('#1 check simple deposit', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;

                await depositContracts.token.approve(contract.address, simpleAmount, {from: INVESTOR_1})
                    .should.be.fulfilled;
                await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
                const userBalanceBefore = await depositContracts.token.balanceOf(INVESTOR_1);
                await contract.invest(userAmount, {from: INVESTOR_1}).should.be.fulfilled;
                const userBalanceAfter = await depositContracts.token.balanceOf(INVESTOR_1);
                userAmountBN.should.be.bignumber.equals(userBalanceBefore - userBalanceAfter);
                const accountInfo = await contract.getAccountInfo(INVESTOR_1);
                const vaultBalanceAfter = await depositContracts.token.balanceOf(accountInfo[0]);
                vaultBalanceAfter.should.be.bignumber.equals(userAmountBN);
            });

            it('#2 check reverts if allowance is not enough', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
                await depositContracts.token.approve(contract.address, simpleAmount / 100, {from: INVESTOR_1})
                    .should.be.fulfilled;
                await contract.invest(userAmount, {from: INVESTOR_1}).should.not.be.fulfilled;
            });

            it('#3 check reverts if amount is less than minimal', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
                await depositContracts.token.approve(contract.address, simpleAmount, {from: INVESTOR_1})
                    .should.be.fulfilled;
                await contract.invest(ETH, {from: INVESTOR_1}).should.not.be.fulfilled;
            });

            it('#4 check reverts if invest called twice', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
                await depositContracts.token.approve(contract.address, simpleAmount, {from: INVESTOR_1})
                    .should.be.fulfilled;
                await contract.invest(simpleAmount, {from: INVESTOR_1}).should.be.fulfilled;
                await contract.invest(simpleAmount, {from: INVESTOR_1}).should.not.be.fulfilled;

            });

            it('#5 check time is tracking', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                await depositContracts.token.approve(contract.address, simpleAmount, {from: INVESTOR_1})
                    .should.be.fulfilled;
                await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
                const currentTime = await getBlockchainTimestamp();
                let contractTime;
                if (_contractPlan != "demo") {
                    contractTime = await contract.depositTime();
                } else {
                    contractTime = TRY_AND_BUY_TIME;
                }

                await contract.invest(userAmount, {from: INVESTOR_1}).should.be.fulfilled;
                const accountInfo = await contract.getAccountInfo(INVESTOR_1);
                const lastWithdrawTime = accountInfo[2];
                const userEndTime = accountInfo[3];
                Number(lastWithdrawTime).should.be.closeTo(currentTime, 10);
                Number(userEndTime).should.be.closeTo(currentTime + Number(contractTime), 10)
            });

            it('#6 check vault created and received tokens from deposit', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                await depositContracts.token.approve(contract.address, simpleAmount, {from: INVESTOR_1})
                    .should.be.fulfilled;
                await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
                await contract.invest(userAmount, {from: INVESTOR_1}).should.be.fulfilled;
                const accountInfo = await contract.getAccountInfo(INVESTOR_1);
                accountInfo[0].should.have.length(42);
                const vaultBalanceAfter = await depositContracts.token.balanceOf(accountInfo[0]);
                vaultBalanceAfter.should.be.bignumber.equals(userAmountBN);
            });
        });

        describe('Calculations and repay', async () =>{
            if (_contractPlan != "demo") {
                it('#1 check replenish', async () => {
                    const depositContracts = await createDepositContracts(_contractPlan);
                    const contract = depositContracts.mainContract;
                    await depositContracts.token.approve(contract.address, simpleAmount, {from: INVESTOR_1})
                        .should.be.fulfilled;
                    await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
                    await contract.invest(userAmount, {from: INVESTOR_1}).should.be.fulfilled;

                    const accountInfo = await contract.getAccountInfo(INVESTOR_1);
                    const accountDeposit = accountInfo[1];
                    const vaultBalance = await depositContracts.token.balanceOf(accountInfo[0]);
                    const userBalance = await depositContracts.token.balanceOf(INVESTOR_1);
                    const contractBalance = await depositContracts.token.balanceOf(contract.address);

                    const currentTime = await getBlockchainTimestamp();
                    const replenishTime = currentTime + DAY;
                    const payouts = await contract.calculateInvestorPayoutsForTime(INVESTOR_1, replenishTime);
                    await timeTo(replenishTime);

                    await contract.replenish(userAmount, {from: INVESTOR_1}).should.be.fulfilled;

                    const userBalanceReplenished = await depositContracts.token.balanceOf(INVESTOR_1);
                    const accountInfoReplenished = await contract.getAccountInfo(INVESTOR_1);
                    const accountDepositReplenished = accountInfoReplenished[1];
                    const vaultBalanceReplenished = await depositContracts.token.balanceOf(accountInfo[0]);
                    const contractBalanceReplenished = await depositContracts.token.balanceOf(contract.address);

                    userBalanceReplenished.should.be.bignumber.at.least(userBalance.add(payouts).sub(userAmountBN));
                    accountDepositReplenished.should.be.bignumber.equals(accountDeposit.add(userAmountBN));
                    vaultBalanceReplenished.should.be.bignumber.equals(vaultBalance.add(userAmountBN));
                });
            };


            it('#2 check payout calculation', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                const percentage = await contract.depositPercentPerDay();
                const minAmount = Number(await contract.minInvestment());

                await depositContracts.token.approve(contract.address, minAmount, {from: INVESTOR_1})
                    .should.be.fulfilled;
                await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;

                await contract.invest(minAmount, {from: INVESTOR_1}).should.be.fulfilled;

                let depositTime = DAY * 15;
                if (_contractPlan == "silver") {
                    depositTime = SILVER_TIME;
                } else if (_contractPlan == "gold") {
                    depositTime = GOLD_TIME;
                } else if (_contractPlan == "platinum") {
                    depositTime = PLATINUM_TIME;
                } else if (_contractPlan == "demo") {
                    depositTime = TRY_AND_BUY_TIME;
                }
                const currentTime = await getBlockchainTimestamp();
                const afterTime = currentTime + depositTime;
                const payoutsPerTime = await contract.calculateInvestorPayoutsForTime(INVESTOR_1, afterTime);
                const payoutPercents = (minAmount * depositTime * (Number(percentage))) / 10000 / DAY;
                payoutPercents.should.be.closeTo(Number(payoutsPerTime), DECIMALS);
            });

            it('#3 check withdraw', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                const investAmountBN = await contract.minInvestment();
                const investAmount = Number(investAmountBN);

                await depositContracts.token.approve(contract.address, investAmount, {from: INVESTOR_1})
                    .should.be.fulfilled;
                await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
                await contract.invest(investAmount, {from: INVESTOR_1}).should.be.fulfilled;

                const accountInfo = await contract.getAccountInfo(INVESTOR_1);
                const accountEndTime = Number(accountInfo[3]);
                const payoutsCalculated = await contract.calculateInvestorPayoutsForTime(INVESTOR_1, accountEndTime + 10);

                await timeTo(accountEndTime + 10);
                const currentTime = await getBlockchainTimestamp();
                Number(currentTime).should.be.greaterThan(accountEndTime);

                const tokenBalanceBefore = await depositContracts.token.balanceOf(INVESTOR_1);

                await contract.withdraw({from: INVESTOR_1}).should.be.fulfilled;
                const tokenBalanceAfter = await depositContracts.token.balanceOf(INVESTOR_1);
                const contractBalanceAfter = await depositContracts.token.balanceOf(contract.address);
                
                tokenBalanceAfter.sub(tokenBalanceBefore).should.be.bignumber.at.least(payoutsCalculated.add(investAmountBN));
                tokenSupplyBN.sub(contractBalanceAfter).should.be.bignumber.at.least(payoutsCalculated);
            });

            it('#4 check withdraw rejects if not enough time', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                const investAmount = Number(await contract.minInvestment());

                await depositContracts.token.approve(contract.address, investAmount, {from: INVESTOR_1})
                    .should.be.fulfilled;
                await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
                await contract.invest(investAmount, {from: INVESTOR_1}).should.be.fulfilled;

                const currentTime = await getBlockchainTimestamp();

                await timeTo(currentTime + DAY).should.be.fulfilled;
                await contract.withdraw({from: INVESTOR_1}).should.be.rejected;
            });
        });

        describe('Events for deposit contract', async () =>{
            it('#1 check add investor event', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                const investAmount = Number(await contract.minInvestment());

                await depositContracts.token.approve(contract.address, investAmount, {from: INVESTOR_1})
                    .should.be.fulfilled;
                await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
                const txInvest = await contract.invest(investAmount, {from: INVESTOR_1}).should.be.fulfilled;
                truffleAssert.eventEmitted(txInvest, 'AddInvestor', (ev) => {
                    return ev._investor.should.be.equals(INVESTOR_1);
                });
                //truffleAssert.prettyPrintEmittedEvents(txInvest);
            });

            it('#2 check remove investor event', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                const investAmount = Number(await contract.minInvestment());

                await depositContracts.token.approve(contract.address, investAmount, {from: INVESTOR_1})
                    .should.be.fulfilled;
                await depositContracts.whitelist.addAddressToWhitelist(INVESTOR_1, {from: OWNER}).should.be.fulfilled;
                await contract.invest(investAmount, {from: INVESTOR_1}).should.be.fulfilled;

                const accountEndTime = Number((await contract.getAccountInfo(INVESTOR_1))[3]);
                await timeTo(accountEndTime + 10);

                const txWithdraw = await contract.withdraw({from: INVESTOR_1}).should.be.fulfilled;

                truffleAssert.eventEmitted(txWithdraw, 'RemoveInvestor', (ev) => {
                    return ev._investor.should.be.equals(INVESTOR_1);
                });
                //truffleAssert.prettyPrintEmittedEvents(txWithdraw);
            });
        });
        

        describe('Other methods', async () => {
            it('#0 check calling airdrop', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                const investAmountBN = await contract.minInvestment();
                const investAmount = Number(investAmountBN);

                await depositContracts.whitelist.addAddressesToWhitelist(INVESTORS, {from: OWNER}).should.be.fulfilled;
                
                let depositTime = DAY * 15;
                if (_contractPlan == "silver") {
                    depositTime = SILVER_TIME;
                } else if (_contractPlan == "gold") {
                    depositTime = GOLD_TIME;
                } else if (_contractPlan == "platinum") {
                    depositTime = PLATINUM_TIME;
                } else if (_contractPlan == "demo") {
                    depositTime = TRY_AND_BUY_TIME;
                };

                const usersCount = INVESTORS.length;
                let usersBalancesBefore = [];

                for (let i = 0; i < usersCount; i++) {
                    await depositContracts.token.approve(contract.address, investAmount, {from: INVESTORS[i]})
                        .should.be.fulfilled;
                    await contract.invest(investAmount, {from: INVESTORS[i]}).should.be.fulfilled;
                    usersBalancesBefore.push(await depositContracts.token.balanceOf(INVESTORS[i]));
                };
                console.log("test")

                const payoutsCalculated = await contract.calculatePayoutsForTime(INVESTORS, depositTime + 10);
                console.log("test1")

                await timeTo(depositTime + 10);
                const currentTime = await getBlockchainTimestamp();
                Number(currentTime).should.be.greaterThan(depositTime);
                
                await contract.airdrop(INVESTORS, {from: OWNER}).should.be.fulfilled;

                const contractBalanceAfter = await depositContracts.token.balanceOf(contract.address);
                contractBalanceBefore.sub(contractBalanceAfter).should.be.bignumber.at.least(payoutsCalculted.mul(usersCount));

                for (let i = 0; i < usersCount; i++) {
                    const balanceAfter = await depositContracts.token.balanceOf(INVESTORS[i]);
                    const balanceBefore = usersBalancesBefore[i];
                    console.log(balanceBefore);
                    console.log(balanceAfter);
                    balanceAfter.sub(balanceBefore).should.be.bignumber.at.least(payoutsCalculated);
                };

            });

            it('#2 check transfer BFCL', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;

                const userBalanceBefore = await depositContracts.token.balanceOf(INVESTOR_1);
                const contractBalanceBefore = await depositContracts.token.balanceOf(contract.address);
                await contract.transferBfcl(INVESTOR_1, tokenSupply, {from: OWNER}).should.be.fulfilled;
                const userBalanceAfter = await depositContracts.token.balanceOf(INVESTOR_1);
                const contractBalanceAfter = await depositContracts.token.balanceOf(contract.address);

                contractBalanceAfter.should.be.bignumber.lessThan(contractBalanceBefore);
                contractBalanceAfter.should.be.zero;

                const userBalance = contractBalanceBefore.add(userBalanceBefore);
                userBalanceAfter.should.be.bignumber.gte(userBalance);
            });

            it('#3 check transfer ERC20', async () => {
                const depositContracts = await createDepositContracts(_contractPlan);
                const contract = depositContracts.mainContract;
                const token = depositContracts.token;

                const userBalanceBefore = await depositContracts.token.balanceOf(INVESTOR_1);
                const contractBalanceBefore = await depositContracts.token.balanceOf(contract.address);
                await contract.transferErc20(token.address, INVESTOR_1, tokenSupply, {from: OWNER}).should.be.fulfilled;
                const userBalanceAfter = await depositContracts.token.balanceOf(INVESTOR_1);
                const contractBalanceAfter = await depositContracts.token.balanceOf(contract.address);

                contractBalanceAfter.should.be.bignumber.lessThan(contractBalanceBefore);
                contractBalanceAfter.should.be.zero;

                const userBalance = new BigNumber(contractBalanceBefore.add(userBalanceBefore));
                userBalanceAfter.should.be.bignumber.gte(userBalance);
            });
        });
    };

    describe('Silver Deposit Plan', async () => {
        await depositContractTests("silver");
    });

    describe('Gold Deposit Plan', async () => {
        await depositContractTests("gold");
    });

    describe('Platinum Deposit Plan', async () => {
        await depositContractTests("platinum");
    });

    describe('Try And Buy Deposit Plan', async () => {
        await depositContractTests("demo");
    });
});
