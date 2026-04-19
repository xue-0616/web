const axios = require("axios");
const url = require("url");

async function getLatestBlockNumber(nodeUrl, chain, provider) {
  const parsedUrl = url.parse(nodeUrl);
  const data = {
    jsonrpc: "2.0",
    method: "eth_blockNumber",
    params: [],
    id: 1,
  };
  try {
    const response = await axios.post(nodeUrl, data);
    if (response.data && response.data.result) {
      const blockNumberHex = response.data.result;
      const blockNumber = parseInt(blockNumberHex, 16);
      return { chain, blockNumber };
    } else {
      console.error(
        `UnipassNodeMonitorCheckFailed: ParseLatestBlockNumberFailed, rpc node is ${parsedUrl.host}, chain is ${chain}, provider is ${provider}`
      );
    }
  } catch (error) {
    console.error(
      `UnipassNodeMonitorCheckFailed: GetLatestBlockNumberFailed, rpc node is ${parsedUrl.host}, chain is ${chain}, provider is ${provider} Error: ${error.message}`
    );
  }
}

async function getPaymentServiceValidatorProcessingBlock(environment) {
  try {
    let host;
    if (environment === "staging") {
      host = "https://staging.pay.unipass.xyz/validator/validator_status";
    } else if (environment === "production") {
      host = "https://pay.unipass.vip/validator/validator_status";
    } else {
      console.error(
        `UnipassNodeMonitorCheckFailed: getPaymentServiceValidatorProcessingBlock failed, unknown environment ${environment}`
      );
      return;
    }
    const response = await axios.get(host);
    if (response.data && response.data.data.chains_status) {
      let result = {};
      const chainsStatus = response.data.data.chains_status;
      chainsStatus.forEach(
        (chainStatus) =>
          (result[chainStatus["chain_id"]] = chainStatus["processing_block"])
      );
      return result;
    } else {
      console.error(
        `UnipassNodeMonitorCheckFailed: getPaymentServiceValidatorProcessingBlock failed, environment is  ${environment}`
      );
    }
  } catch (error) {
    console.error(
      `UnipassNodeMonitorCheckFailed: getPaymentServiceValidatorProcessingBlock failed, environment is  ${environment}`
    );
  }
}

module.exports = {
  getLatestBlockNumber,
  getPaymentServiceValidatorProcessingBlock,
};
