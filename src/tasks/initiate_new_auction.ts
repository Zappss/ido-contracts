import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { ethers } from "ethers";
import { task, types } from "hardhat/config";

import { getEasyAuctionContract } from "./utils";

const initiateAuction: () => void = () => {
  task("initiateAuction", "Starts a new auction")
    .addParam(
      "auctioningToken",
      "The ERC20's address of the token that should be sold",
    )
    .addParam(
      "biddingToken",
      "The ERC20's address of the token that should be bought",
    )
    .addParam(
      "sellAmount",
      "The amount of auctioningTokens to be sold in atoms",
    )
    .addParam(
      "minBuyAmount",
      "The amount of biddingToken to be bought at least for selling sellAmount in atoms",
    )
    .addOptionalParam(
      "minFundingThreshold",
      "The minimal funding threshold for executing the settlement. If funding is not reached, everyone will get back their investment",
      "0",
      types.string,
    )
    .addOptionalParam(
      "orderCancellationPeriod",
      "Describes how long the auction should allow to cancel orders in seconds",
      "0",
      types.string,
    )
    .addOptionalParam(
      "duration",
      "Describes how long the auction should last in seconds",
      "360000",
      types.string,
    )
    .addOptionalParam(
      "minBuyAmountPerOrder",
      "Describes the minimal buyAmount per order placed in the auction. This can be used in order to protect against too high gas costs for the settlement",
      "0.01",
      types.string,
    )
    .addOptionalParam(
      "isAtomicClosureAllowed",
      "Describes whether the auction should be allowed to be closed atomically",
      false,
      types.boolean,
    )
    .setAction(async (taskArgs, hardhatRuntime) => {
      const [caller] = await hardhatRuntime.ethers.getSigners();
      console.log("Using the account:", caller.address);

      const easyAuction = await getEasyAuctionContract(hardhatRuntime);
      const biddingToken = await hardhatRuntime.ethers.getContractAt(
        "ERC20",
        taskArgs.biddingToken,
      );
      const auctioningToken = await hardhatRuntime.ethers.getContractAt(
        "ERC20",
        taskArgs.auctioningToken,
      );
      const sellAmountsInAtoms = ethers.utils.parseUnits(
        taskArgs.sellAmount,
        await auctioningToken.callStatic.decimals(),
      );
      const minBuyAmountInAtoms = ethers.utils.parseUnits(
        taskArgs.minBuyAmount,
        await biddingToken.callStatic.decimals(),
      );
      const minParticipantsBuyAmount = ethers.utils.parseUnits(
        taskArgs.minBuyAmountPerOrder,
        await biddingToken.callStatic.decimals(),
      );
      const minFundingThresholdInAtoms = ethers.utils.parseUnits(
        taskArgs.minFundingThreshold,
        await biddingToken.callStatic.decimals(),
      );

      console.log("Using EasyAuction deployed to:", easyAuction.address);

      const balance = await auctioningToken.callStatic.balanceOf(
        caller.address,
      );
      if (sellAmountsInAtoms.gt(balance)) {
        return new Error("Balance not sufficient");
      }

      const allowance = await auctioningToken.callStatic.allowance(
        caller.address,
        easyAuction.address,
      );
      if (sellAmountsInAtoms.gt(allowance)) {
        console.log("Approving tokens:");
        const tx = await auctioningToken
          .connect(caller)
          .approve(easyAuction.address, sellAmountsInAtoms);
        await tx.wait();
        console.log("Approved");
      }

      console.log("Starting Auction:");
      const tx = await easyAuction
        .connect(caller)
        .initiateAuction(
          auctioningToken.address,
          biddingToken.address,
          taskArgs.orderCancellationPeriod,
          taskArgs.duration,
          sellAmountsInAtoms,
          minBuyAmountInAtoms,
          minParticipantsBuyAmount,
          minFundingThresholdInAtoms,
          taskArgs.isAtomicClosureAllowed,
        );
      const txResult = await tx.wait();
      const auctionId = txResult.events
        .filter((event: any) => event.event === "NewAuction")
        .map((event: any) => event.args.auctionId);
      console.log(
        "Your auction has been schedule and has the Id:",
        auctionId.toString(),
      );
    });
};
export { initiateAuction };

// Rinkeby tests task selling WETH for DAI:
// yarn hardhat initiateAuction --auctioning-token "0xc778417e063141139fce010982780140aa0cd5ab" --bidding-token "0x5592EC0cfb4dbc12D3aB100b257153436a1f0FEa" --sell-amount 0.1 --min-buy-amount 50 --network rinkeby
