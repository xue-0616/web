const cron = require("node-cron");
const url = require("url");

global.latestBlockNumber = new Map();
global.paymentServiceStagingValidatorProcessingBlocks = new Map();

const providers = require("./providers.json");

const chainIds = {
  "arbitrum-mainnet": 42161,
  "arbitrum-testnet": 421613,
  "bsc-mainnet": 56,
  "bsc-testnet": 97,
  "polygon-mainnet": 137,
  "polygon-mumbai": 80001,
};
const distanceThreshold = {
  42161: 1000,
  421613: 1000,
  56: 100,
  97: 100,
  80001: 150,
  137: 150,
};

const {
  getLatestBlockNumber,
  getPaymentServiceValidatorProcessingBlock,
} = require("./utils.js");

async function checkLatestBlockNumber() {
  const promises = [];
  Object.keys(providers).forEach((chain) =>
    providers[chain].forEach((item) => {
      const parsedUrl = url.parse(item);
      promises.push(getLatestBlockNumber(item, chain, parsedUrl.host));
    })
  );
  let result = await Promise.all(promises);
  console.log(`Current Providers' LatestBlockNumber ${JSON.stringify(result)}`);
}

async function checkStagingValidatorProcessingBlock() {
  await checkValidatorProcessingBlock("staging");
}

async function checkProductionValidatorProcessingBlock() {
  await checkValidatorProcessingBlock("production");
}

async function checkValidatorProcessingBlock(environment) {
  const processingBlocks = await getPaymentServiceValidatorProcessingBlock(
    environment
  );
  let cachedBlockNumbers = {};
  for (const item in global.latestBlockNumber) {
    if (chainIds[item]) {
      cachedBlockNumbers[chainIds[item]] = global.latestBlockNumber[item];
    }
  }
  for (const item in processingBlocks) {
    let threshold = distanceThreshold[`${item}`];
    let currentBlockNumber = cachedBlockNumbers[`${item}`];
    let processingBlockNumber = processingBlocks[`${item}`];
    // Fail-loud if we have no cached head for this chain, otherwise the
    // comparison `undefined - N > threshold` evaluates to `NaN > N` which is
    // false, silently letting the monitor report "check pass" with no data.
    if (currentBlockNumber === undefined || currentBlockNumber === null) {
      console.error(
        `UnipassNodeMonitorCheckFailed: Missing cached head for chain ${item}, environment is ${environment}, processingBlockNumber is ${processingBlockNumber}`
      );
      continue;
    }
    if (threshold === undefined) {
      console.error(
        `UnipassNodeMonitorCheckFailed: Missing distance threshold for chain ${item}, environment is ${environment}`
      );
      continue;
    }
    if (currentBlockNumber - processingBlockNumber > threshold) {
      console.log(
        `UnipassNodeMonitorCheckFailed: Validator falls behind, environment is ${environment}, chain is ${item}, threshold is ${threshold}, currentDistance is ${
          currentBlockNumber - processingBlockNumber
        }, latestBlockNumber is ${currentBlockNumber}, processingBlockNumber is ${processingBlockNumber}, environment is ${environment}`
      );
    } else {
      console.log(
        `Validator check pass, environment is ${environment}, chain is ${item}, threshold is ${threshold}, currentDistance is ${
          currentBlockNumber - processingBlockNumber
        }, latestBlockNumber is ${currentBlockNumber}, processingBlockNumber is ${processingBlockNumber}, environment is ${environment}`
      );
    }
  }
}

async function checkUnipassWorkerNode() {
  const nodeDomain = "https://node2.wallet.unipass.id";
  const promises = Object.keys(providers).map((chain) =>
    getLatestBlockNumber(`${nodeDomain}/${chain}`, chain)
  );
  let result = await Promise.all(promises);
  console.log(
    `Current cached UnipassWorkerNode blockNumber ${JSON.stringify(result)}`
  );
  result.forEach((item) => {
    if (item) {
      if (
        !global.latestBlockNumber[item.chain] ||
        global.latestBlockNumber[item.chain] < item.blockNumber
      ) {
        global.latestBlockNumber[item.chain] = item.blockNumber;
      } else {
        console.error(
          `UnipassNodeMonitorCheckFailed: CheckUnipassWorkerNodeFailed, rpc node is ${nodeDomain}/${chain}, cached block number is ${
            global.latestBlockNumber[item.chain]
          }, updating block number is ${item.blockNumber}`
        );
      }
    }
  });
}

// check worker node every 5 mins
cron.schedule("*/5 * * * *", checkUnipassWorkerNode);

// check rpc node every 5 mins
cron.schedule("*/5 * * * *", checkLatestBlockNumber);

// check production payment service validator processing block every 5 mins
cron.schedule("*/5 * * * *", checkStagingValidatorProcessingBlock);

// check production payment service validator processing block every 5 mins
cron.schedule("*/5 * * * *", checkProductionValidatorProcessingBlock);
