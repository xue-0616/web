export enum EVENT_TYPE {
  SET_SOURCE = 0,
  UPDATE_KEY_SET_HASH = 1,
  UPDATE_KEY_SET_HASH_WITH_TIME_LOCK = 2,
  CANCEL_LOCK_KEY_SET_HASH = 3,
  UNLOCL_KEY_SET_HASH = 4,
  SYNC_ACCOUNT = 5,
  UPDATE_OPENID_KEY = 6,
  DELETE_OPENID_KEY_TOPIC = 7,
  UPDATE_DKIM_KEY_TOPIC_1 = 8,
  UPDATE_DKIM_KEY_TOPIC_2 = 9,
  DELETE_DKIM_KEY_TOPIC = 10,
}

export const Topics = {
  setSource: '0x6b58896f57ac994c862f65d6b6c9762f1bbeebb1a91da87a2dfc481e4500edd7',
  updateKetsetHash: '0xa2c25883abfa8d72e643bcb5451e489d4e2c1b17526bf6ee946d248295e4b0c4',
  updateRecoveryHashWithTimeLock: '0x0430d938a3bd3218e211c389c2208dcda424f9fc2d9cc35b9527e1ecc9a7d09e',
  cancleKeysetHash: '0x28b24d7fd5eae8f1c3e175db01de3e8a72de973313eafa9c6b56dba2092d3023',
  completeRecovey: '0x8b6ae36058c8bfedda4afe24260c49095eeccc886321ccc992a5de5734e35444',
  syncAccount: '0x3e38671b32212f393ab439aa8a9380582d096abd3e949a38ceb3ad740ec124ad',
  updateOpenIdKey: '0x09c7228183e89663fa47ccbf317d3ac5e228a62848b5c29017eb05cb1a7224bc',
  deleteOpenIdKey: '0x2dcad5593eade66ba317c839f2c7cd4b40bf9348055df767870cc43eb955e99f',
  updateDkimTopic1: '0x135a027345c9aaf1ccab4b641f3c6ee50e321835629451d26d3707fb9d76e6a5',
  updateDkimTopic2: '0x607078740a1c62de04674a693e36d3b96cb19dac621901cab41f69e157226182',
  deleteDkimTopic: '0x4642b1a1914e0071f004a4db2aa2b8a00e93f6ad530bf1ef2e539e4f84b8b2f2',
} as const;

export const TopicEventType: Record<string, EVENT_TYPE> = {
  [Topics.setSource]: EVENT_TYPE.SET_SOURCE,
  [Topics.updateKetsetHash]: EVENT_TYPE.UPDATE_KEY_SET_HASH,
  [Topics.updateRecoveryHashWithTimeLock]: EVENT_TYPE.UPDATE_KEY_SET_HASH_WITH_TIME_LOCK,
  [Topics.cancleKeysetHash]: EVENT_TYPE.CANCEL_LOCK_KEY_SET_HASH,
  [Topics.completeRecovey]: EVENT_TYPE.UNLOCL_KEY_SET_HASH,
  [Topics.syncAccount]: EVENT_TYPE.SYNC_ACCOUNT,
  [Topics.updateOpenIdKey]: EVENT_TYPE.UPDATE_OPENID_KEY,
  [Topics.deleteOpenIdKey]: EVENT_TYPE.DELETE_OPENID_KEY_TOPIC,
  [Topics.updateDkimTopic1]: EVENT_TYPE.UPDATE_DKIM_KEY_TOPIC_1,
  [Topics.updateDkimTopic2]: EVENT_TYPE.UPDATE_DKIM_KEY_TOPIC_2,
  [Topics.deleteDkimTopic]: EVENT_TYPE.DELETE_DKIM_KEY_TOPIC,
};

export interface EventInfo {
  address?: string;
  blockNumber?: string;
  timeStamp?: string;
  hash?: string;
  transactionHash?: string;
  gasPrice?: string;
  gasUsed?: string;
  data?: string;
  topics: string[];
  [key: string]: any;
}

export interface TxNormal {
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  timeStamp?: string;
  gasPrice?: string;
  gasUsed?: string;
  [key: string]: any;
}

export interface TxInternal extends TxNormal {}

export interface TxErc20 extends TxNormal {
  tokenName?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
}
