import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedPhantomDB = await deploy("PhantomDB", {
    from: deployer,
    log: true,
  });

  console.log(`PhantomDB contract: `, deployedPhantomDB.address);
};
export default func;
func.id = "deploy_phantomdb"; // id required to prevent reexecution
func.tags = ["PhantomDB"];
