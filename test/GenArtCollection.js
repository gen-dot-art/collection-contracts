const { expectEvent } = require('@openzeppelin/test-helpers');
const BigNumber = require('bignumber.js');
BigNumber.config({ EXPONENTIAL_AT: 9999 });
const GenArtCollection = artifacts.require('GenArtCollection.sol');
const GenArtInterface = artifacts.require('GenArtInterface.sol');
const GenArtSale = artifacts.require('GenArt.sol');
const GenArtToken = artifacts.require('GenArtToken.sol');
const URI_1 = 'https://localhost:8080/premium/';
const URI_2 = 'https://localhost:8080/gold/';
const URI = 'https://localhost:8080/attributes/';
const SCALE = new BigNumber(10).pow(18);
const NAME = 'TEST';
const SYMBOL = 'SYMB';
const SCRIPT = 'script';
const price = new BigNumber(0.0001).times(SCALE);
const priceStandard = new BigNumber(0.1).times(SCALE);
const priceGold = new BigNumber(0.5).times(SCALE);
const priceGen = new BigNumber(1).times(SCALE);
const artistPercentage = 50;
const maxInvocations = '3';

let owner;
let user1;
let user2;
let user3;
let artist;
let zeroAddress = '0x0000000000000000000000000000000000000000';
let genArtCollection;
let genArtMembership;
let genArtToken;

contract('GenArtCollection', (accounts) => {
  before(async () => {
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    artist = user3;

    genArtMembership = await GenArtSale.new(NAME, SYMBOL, URI_1, URI_2, 10, {
      from: owner,
    });
    await genArtMembership.setPaused(false, {
      from: owner,
    });
    await genArtMembership.mint(user1, {
      from: user1,
      value: priceStandard,
    });
    await genArtMembership.mintGold(user1, {
      from: user1,
      value: priceGold,
    });

    genArtInterface = await GenArtInterface.new(genArtMembership.address, {
      from: owner,
    });

    genArtCollection = await GenArtCollection.new(
      NAME,
      SYMBOL,
      URI,
      genArtInterface.address,
      {
        from: owner,
      }
    );
  });

  after(async () => {});

  it('create collection', async () => {
    await genArtCollection.createGenCollection(
      artist,
      artistPercentage,
      price,
      priceGen,
      maxInvocations,
      3,
      SCRIPT,
      {
        from: owner,
      }
    );
  });

  it('should throw error if unauthorized calls createGenCollection', async () => {
    try {
      await genArtCollection.createGenCollection(
        artist,
        artistPercentage,
        price,
        priceGen,
        maxInvocations,
        1,
        SCRIPT,
        {
          from: user1,
        }
      );
    } catch (err) {
      expect(err.reason.includes('caller is not the owner')).to.be.true;
      return;
    }
    throw new Error('Unauthorized can create collection');
  });

  it('throw error if sender has no membership', async () => {
    try {
      await genArtCollection.mint(user2, '1', '1', {
        from: user2,
        value: price,
      });
    } catch (err) {
      expect(err.reason.includes('sender must be membership owner')).to.be.true;
      return;
    }
    throw new Error('mint broken');
  });

  it('throw error on wrong amount sent to mint', async () => {
    try {
      const price = new BigNumber(0.00001).times(SCALE);
      await genArtCollection.mint(user1, '1', '1', {
        from: user1,
        value: price,
      });
    } catch (err) {
      expect(err.reason.includes('incorrect amount sent')).to.be.true;
      return;
    }
    throw new Error('mint broken');
  });

  it('mint NFT for ETH and split funds for owner and artist', async () => {
    const balanceOldOwner = await web3.eth.getBalance(genArtCollection.address);
    const balanceOldArtist = await web3.eth.getBalance(artist);
    const tx = await genArtCollection.mint(user1, '1', '1', {
      from: user1,
      value: price,
    });
    expectEvent(tx, 'Transfer', {
      from: zeroAddress,
      to: user1,
      tokenId: '100001',
    });
    expectEvent(tx, 'Mint', {
      to: user1,
      collectionId: '1',
      tokenId: '100001',
    });
    const balance = await genArtCollection.balanceOf.call(user1, {
      from: user1,
    });
    const balanceNewOwner = await web3.eth.getBalance(genArtCollection.address);
    const balanceNewArtist = await web3.eth.getBalance(artist);
    const artistReward = price.times(artistPercentage).div(100);
    const expectOwnerReward = price.minus(artistReward);
    expect(expectOwnerReward.plus(balanceOldOwner).toString()).equals(
      balanceNewOwner
    );
    expect(artistReward.plus(balanceOldArtist).toString()).equals(
      balanceNewArtist
    );
    expect(balance.toString()).equals('1');
  });

  it('throw error if membership was already used for minting', async () => {
    try {
      await genArtCollection.mint(user1, '1', '1', {
        from: user1,
        value: price,
      });
    } catch (err) {
      expect(err.reason.includes('no mints')).to.be.true;
      return;
    }
    throw new Error('mint broken');
  });

  it('allow $GENART as payment', async () => {
    await genArtInterface.setAllowGen(true, {
      from: owner,
    });
    genArtToken = await GenArtToken.new('GEN.ART Token', 'GENART', {
      from: owner,
    });
    await genArtToken.transfer(user1, priceGen.times(100), { from: owner });

    await genArtInterface.upgradeGenArtTokenContract(genArtToken.address, {
      from: owner,
    });
  });

  it('mint NFT for $GENART and split funds for owner and artist', async () => {
    const balanceOldOwner = await genArtToken.balanceOf(owner);
    const balanceOldArtist = await genArtToken.balanceOf(artist);
    await genArtToken.approve(genArtInterface.address, priceGen, {
      from: user1,
    });
    const tx = await genArtCollection.mintGen(user1, '1', '11', {
      from: user1,
    });
    expectEvent(tx, 'Transfer', {
      from: zeroAddress,
      to: user1,
      tokenId: '100002',
    });
    expectEvent(tx, 'Mint', {
      to: user1,
      collectionId: '1',
      tokenId: '100002',
    });
    const balance = await genArtCollection.balanceOf.call(user1, {
      from: user1,
    });
    const balanceNewOwner = await genArtToken.balanceOf(owner);
    const balanceNewArtist = await genArtToken.balanceOf(artist);
    const artistReward = priceGen.times(artistPercentage).div(100);
    const expectOwnerReward = priceGen.minus(artistReward);
    expect(expectOwnerReward.plus(balanceOldOwner).toString()).equals(
      balanceNewOwner.toString()
    );
    expect(artistReward.plus(balanceOldArtist).toString()).equals(
      balanceNewArtist.toString()
    );
    expect(balance.toString()).equals('2');
  });

  it('throw error if unauthorized calls burn', async () => {
    try {
      await genArtCollection.mint(user1, '1', '11', {
        from: user1,
        value: price,
      });
      await genArtCollection.burn('100003', { from: user2 });
    } catch (err) {
      expect(err.reason.includes('only token owner')).to.be.true;
      return;
    }
    throw new Error('Unauthorized can burn broken');
  });

  it('burns token', async () => {
    const tx = await genArtCollection.burn('100003', { from: user1 });
    expectEvent(tx, 'Transfer', {
      to: zeroAddress,
      from: user1,
      tokenId: '100003',
    });
  });

  it('throws error if unauthorized calls updateArtistAddress', async () => {
    try {
      await genArtCollection.updateArtistAddress('1', user1, { from: user1 });
    } catch (err) {
      expect(err.reason.includes('only artist')).to.be.true;
      return;
    }
    throw new Error('updateArtistAddress broken');
  });

  it('updates artist address', async () => {
    await genArtCollection.updateArtistAddress('1', user1, { from: artist });
    const info = await genArtCollection.getCollectionInfo.call('1');
    expect(info.artist).equals(user1);
  });

  it('throws error if unauthorized calls updateMaxInvocations', async () => {
    try {
      await genArtCollection.updateMaxInvocations('1', 4, { from: user1 });
    } catch (err) {
      expect(err.reason.includes('caller is not the owner')).to.be.true;
      return;
    }
    throw new Error('updateArtistAddress broken');
  });

  it('updates max invocations', async () => {
    await genArtCollection.updateMaxInvocations('1', '8', { from: owner });
    await genArtCollection.mint(user1, '1', '11', {
      from: user1,
      value: price,
    });
    const info = await genArtCollection.getCollectionInfo.call('1');
    expect(info.maxInvocations.toString()).equals('8');
    expect(info.invocations.toString()).equals('4');
  });

  it('mint NFT many', async () => {
    await genArtMembership.mintGold(user2, {
      from: user2,
      value: priceGold,
    });
    await genArtCollection.mintMany(user2, '1', '12', '3', {
      from: user2,
      value: price.times(3),
    });
    const tx = await genArtCollection.mintMany(user2, '1', '12', '2', {
      from: user2,
      value: price.times(3),
    });

    expectEvent(tx, 'Transfer', {
      from: zeroAddress,
      to: user2,
      tokenId: '100008',
    });
    expectEvent(tx, 'Mint', {
      to: user2,
      collectionId: '1',
      tokenId: '100008',
    });
  });

  it('throws error if max invocations was reached', async () => {
    try {
      await genArtCollection.mint(user1, '1', '11', {
        from: user1,
        value: price,
      });
    } catch (err) {
      expect(err.reason.includes('max invocations')).to.be.true;
      return;
    }
    throw new Error('max invocations require broken');
  });

  it('throws error if unauthorized calls setNewOwner', async () => {
    try {
      await genArtCollection.transferOwnership(user1, { from: user1 });
    } catch (err) {
      expect(err.reason.includes('caller is not the owner')).to.be.true;
      return;
    }
    throw new Error('setNewOwner broken');
  });

  it('sets new contract owner', async () => {
    await genArtCollection.transferOwnership(user3, { from: owner });
    await genArtCollection.createGenCollection(
      artist,
      artistPercentage,
      price,
      priceGen,
      maxInvocations,
      1,
      SCRIPT,
      {
        from: user3,
      }
    );
  });

  it('restrict mint to tier', async () => {
    try {
      await genArtCollection.mint(user2, '2', '12', {
        from: user2,
        value: price,
      });
    } catch (err) {
      expect(err.reason.includes('no valid membership')).to.be.true;
      return;
    }
    throw new Error('withdraw broken');
  });

  it('throws error if unauthorized calls withdraw', async () => {
    try {
      const value = new BigNumber(0.001).times(SCALE);
      await genArtCollection.withdraw(value, { from: user1 });
    } catch (err) {
      expect(err.reason.includes('caller is not the owner')).to.be.true;
      return;
    }
    throw new Error('withdraw broken');
  });

  it('withdraw to owner', async () => {
    const contractBalance = await web3.eth.getBalance(genArtCollection.address);
    const gasPrice = new BigNumber(10).pow(11).times(43);
    const balanceOldOwner = await web3.eth.getBalance(user3);
    const tx = await genArtCollection.withdraw(contractBalance, {
      from: user3,
      gasPrice,
    });
    const gas = new BigNumber(tx.receipt.gasUsed).times(gasPrice);
    const balanceNewOwner = await web3.eth.getBalance(user3);
    expect(
      new BigNumber(contractBalance).plus(balanceOldOwner).minus(gas).toString()
    ).equals(balanceNewOwner);
  });

  it('get correct tokenUri', async () => {
    const url = await genArtCollection.tokenURI.call('100001', { from: user1 });
    expect(url.toString()).equals(`${URI}100001`);
  });

  it('get total supply', async () => {
    const supply = await genArtCollection.totalSupply.call({ from: user1 });
    expect(supply.toString()).equals(`8`);
  });

  it('get tokens of owner', async () => {
    const supply = await genArtCollection.getTokensByOwner.call(user1);
    expect(supply.length.toString()).equals(`3`);
  });
});
