/**
 * Alchemy Polygon: eth_getLogs parçalı çekme (Free plan: 10 blok/istek).
 */
import { JsonRpcProvider } from "ethers";
import { loadYaml } from "./config.js";

const cfg = loadYaml("data_pipeline") as Record<string, unknown>;
const alchemyCfg = (cfg.alchemy as Record<string, unknown>) ?? {};
const maxBlocksPerRequest = (alchemyCfg.max_blocks_per_request as number) ?? 10;
const defaultContract = (alchemyCfg.contract_address as string) ?? "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

export interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
}

/**
 * from_block..to_block aralığını parçalara bölüp getLogs çeker.
 */
export async function fetchLogsChunked(
  rpcUrl: string,
  contractAddress: string,
  fromBlock: number,
  toBlock: number,
  maxBlocks: number = maxBlocksPerRequest
): Promise<LogEntry[]> {
  const provider = new JsonRpcProvider(rpcUrl);
  const allLogs: LogEntry[] = [];
  let start = fromBlock;
  const contract = contractAddress;

  while (start <= toBlock) {
    const end = Math.min(start + maxBlocks - 1, toBlock);
    const logs = await provider.getLogs({
      address: contract,
      fromBlock: BigInt(start),
      toBlock: BigInt(end),
    });
    for (const log of logs) {
      allLogs.push({
        address: log.address,
        topics: log.topics as string[],
        data: log.data,
        blockNumber: Number(log.blockNumber),
        transactionHash: log.transactionHash,
      });
    }
    start = end + 1;
  }
  return allLogs;
}

export { defaultContract };
