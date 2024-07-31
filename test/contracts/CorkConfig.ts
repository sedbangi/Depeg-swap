import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseEther, parseUnits, zeroAddress } from "viem";
import * as helper from "../helper/TestHelper";

describe("CorkConfig", function () {
  let defaultSigner: any;
  let secondSigner: any;
  let signers: any;

  let expiryTime: any;
  let mintAmount: any;
  let Id: any;

  let fixture: any;

  let moduleCore: any;
  let corkConfig: any;
  let pa: any;

  before(async () => {
    ({ defaultSigner, signers } = await helper.getSigners());
    secondSigner = signers[1];
  });

  beforeEach(async () => {
    fixture = await loadFixture(
      helper.ModuleCoreWithInitializedPsmLv
    );

    moduleCore = await hre.viem.getContractAt(
      "ModuleCore",
      fixture.moduleCore.contract.address
    );
    corkConfig = await hre.viem.getContractAt(
      "CorkConfig",
      fixture.config.contract.address
    );

    expiryTime = helper.expiry(1e18 * 1000);
    mintAmount = parseEther("1000");

    await fixture.ra.write.approve([
      fixture.moduleCore.contract.address,
      mintAmount,
    ]);

    await helper.mintRa(
      fixture.ra.address,
      defaultSigner.account.address,
      mintAmount
    );

    pa = await hre.viem.getContractAt("ERC20", fixture.pa.address);
    Id = await moduleCore.read.getId([
      fixture.pa.address,
      fixture.ra.address,
    ]);
  });

  it("should deploy correctly", async function () {
    corkConfig = await hre.viem.deployContract("CorkConfig", [],
      {
        client: {
          wallet: defaultSigner,
        }
      }
    );
    expect(corkConfig).to.be.ok;
    expect(await corkConfig.read.hasRole([await corkConfig.read.DEFAULT_ADMIN_ROLE(),
    defaultSigner.account.address]
    )).to.be.equals(true);
    expect(await corkConfig.read.hasRole([await corkConfig.read.MANAGER_ROLE(),
    defaultSigner.account.address]
    )).to.be.equals(false);
    expect(await corkConfig.read.paused()).to.be.equals(false);
  });

  describe("SetModuleCore", function () {
    it("setModuleCore should work correctly", async function () {
      expect(await corkConfig.read.moduleCore()).to.not.be.equals(defaultSigner.account.address);
      await expect(await corkConfig.write.setModuleCore([secondSigner.account.address], {
        account: defaultSigner.account,
      })).to.be.ok;
      expect(await (await corkConfig.read.moduleCore()).toLowerCase()).to.be.equals(secondSigner.account.address);
    })

    it("Revert when passed zero address to setModuleCore", async function () {
      await expect(corkConfig.write.setModuleCore([zeroAddress], {
        account: defaultSigner.account,
      })).to.be.rejectedWith('InvalidAddress()');
    })

    it("Revert when non MANAGER call setModuleCore", async function () {
      await expect(corkConfig.write.setModuleCore([defaultSigner.account.address], {
        account: secondSigner.account,
      })).to.be.rejectedWith('CallerNotManager()');
    })
  });

  describe("initializeModuleCore", function () {
    it("initializeModuleCore should work correctly", async function(){
      const {pa, ra} = await loadFixture(
        helper.backedAssets
      );  
      await expect(await corkConfig.write.initializeModuleCore(
        [
          pa.address,
          ra.address,
          fixture.lvFee,
          fixture.lvAmmWaDepositThreshold,
          fixture.lvAmmCtDepositThreshold
        ], {
        account: defaultSigner.account,
      })).to.be.ok;
    });

    it("Revert when non MANAGER call initializeModuleCore", async function () {
      await expect(corkConfig.write.initializeModuleCore(
        [
          pa.address,
          fixture.ra.address,
          fixture.lvFee,
          fixture.lvAmmWaDepositThreshold,
          fixture.lvAmmCtDepositThreshold
        ], {
        account: secondSigner.account,
      })).to.be.rejectedWith('CallerNotManager()');
    })
  })

  describe("issueNewDs", function () {
    it("issueNewDs should work correctly", async function(){
      await expect(await corkConfig.write.issueNewDs(
        [Id, BigInt(expiryTime), parseEther("1"), parseEther("10")], {
        account: defaultSigner.account,
      })).to.be.ok;
    });

    it("Revert issueNewDs when contract is paused", async function () {
      await corkConfig.write.pause({
        account: defaultSigner.account,
      });

      await expect(corkConfig.write.issueNewDs(
        [Id, BigInt(expiryTime), parseEther("1"), parseEther("10")],
        {
          account: secondSigner.account,
        }
      )).to.be.rejectedWith('EnforcedPause()');
    })

    it("Revert when non MANAGER call issueNewDs", async function () {
      await expect(corkConfig.write.issueNewDs(
        [Id, BigInt(expiryTime), parseEther("1"), parseEther("10")],
        {
          account: secondSigner.account,
        }
      )).to.be.rejectedWith('CallerNotManager()');
    })
  })

  describe("updateRepurchaseFeeRate", function () {
    it("updateRepurchaseFeeRate should work correctly", async function () {
      expect(await moduleCore.read.repurchaseFee([Id])).to.be.equals(parseUnits("0", 1));
      await expect(await corkConfig.write.updateRepurchaseFeeRate(
        [Id, 1000], {
        account: defaultSigner.account,
      })).to.be.ok;
      expect(await moduleCore.read.repurchaseFee([Id])).to.be.equals(parseUnits("1000", 0));
    })

    it("Revert when non MANAGER call updateRepurchaseFeeRate", async function () {
      await expect(corkConfig.write.updateRepurchaseFeeRate(
        [Id, 1000],
        {
          account: secondSigner.account,
        }
      )).to.be.rejectedWith('CallerNotManager()');
    })
  })

  describe("updateEarlyRedemptionFeeRate", function () {
    it("updateEarlyRedemptionFeeRate should work correctly", async function () {
      expect(await moduleCore.read.earlyRedemptionFee([Id])).to.be.equals(parseEther("10"));
      await expect(await corkConfig.write.updateEarlyRedemptionFeeRate(
        [Id, 1000], {
        account: defaultSigner.account,
      })).to.be.ok;
      expect(await moduleCore.read.earlyRedemptionFee([Id])).to.be.equals(parseUnits("1000", 0));
    })

    it("Revert when non MANAGER call updateEarlyRedemptionFeeRate", async function () {
      await expect(corkConfig.write.updateEarlyRedemptionFeeRate(
        [Id, 1000],
        {
          account: secondSigner.account,
        }
      )).to.be.rejectedWith('CallerNotManager()');
    })
  })

  describe("Pause", function () {
    it("pause should work correctly", async function () {
      expect(await corkConfig.read.paused()).to.be.equals(false);

      await expect(await corkConfig.write.pause({
        account: defaultSigner.account,
      })).to.be.ok;

      expect(await corkConfig.read.paused()).to.be.equals(true);
    })

    it("Revert when non MANAGER call pause", async function () {
      await expect(corkConfig.write.pause({
        account: secondSigner.account,
      })).to.be.rejectedWith('CallerNotManager()');
    })
  })

  describe("Unpause", function () {
    it("unpause should work correctly", async function () {
      await corkConfig.write.pause();

      expect(await corkConfig.read.paused()).to.be.equals(true);

      await expect(await corkConfig.write.unpause({
        account: defaultSigner.account,
      })).to.be.ok;

      expect(await corkConfig.read.paused()).to.be.equals(false);
    })

    it("Revert when non MANAGER call unpause", async function () {
      await expect(corkConfig.write.unpause({
        account: secondSigner.account,
      })).to.be.rejectedWith('CallerNotManager()');
    })
  })
});
