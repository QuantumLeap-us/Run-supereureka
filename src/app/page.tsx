"use client";

import {
  Button,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Switch,
  TextField,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";
import {
  Chain,
  createPublicClient,
  createWalletClient,
  Hex,
  http,
  isAddress,
  parseEther,
  SendTransactionErrorType,
  stringToHex,
  webSocket,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";

import Log from "@/components/Log";
import { ChainKey, inscriptionChains } from "@/config/chains";
import useInterval from "@/hooks/useInterval";
import { handleAddress, handleLog } from "@/utils/helper";

const example =
  'data:,{"p":"asc-20","op":"mint","tick":"aval","amt":"100000000"}';

type RadioType = "meToMe" | "manyToOne";
type GasRadio = "all" | "tip";

export default function Home() {
  const [chain, setChain] = useState<Chain>(mainnet);
  const [privateKeys, setPrivateKeys] = useState<Hex[]>([]);
  const [radio, setRadio] = useState<RadioType>("meToMe");
  const [toAddress, setToAddress] = useState<Hex>();
  const [rpc, setRpc] = useState<string>();
  const [inscription, setInscription] = useState<string>("");
  const [gas, setGas] = useState<number>(0);
  const [running, setRunning] = useState<boolean>(false);
  const [delay, setDelay] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [nonces, setNonces] = useState<number[]>([]);
  const [pause, setPause] = useState<boolean>(false);
  const [fastMode, setFastMode] = useState<boolean>(false);
  const [gasRadio, setGasRadio] = useState<GasRadio>("tip");

  const pushLog = useCallback((log: string, state?: string) => {
    setLogs((logs) => [handleLog(log, state), ...logs]);
  }, []);

  const client = useMemo(
    () =>
      createWalletClient({
        chain,
        transport: rpc && rpc.startsWith("wss") ? webSocket(rpc) : http(rpc),
      }),
    [chain, rpc],
  );

  const publicClient = useMemo(
    () =>
      createPublicClient({
        chain,
        transport: rpc && rpc.startsWith("wss") ? webSocket(rpc) : http(rpc),
      }),
    [chain, rpc],
  );

  const accounts = useMemo(
    () => privateKeys.map((key) => privateKeyToAccount(key)),
    [privateKeys],
  );

  const getNonces = useCallback(async () => {
    const res = await Promise.all(
      accounts.map((account) =>
        publicClient.getTransactionCount({
          address: account.address,
        }),
      ),
    );
    setNonces(res);
  }, [accounts, publicClient]);

  useInterval(
    async (count) => {
      Promise.allSettled(
        accounts.map((account, index) => {
          return client.sendTransaction({
            account,
            to: radio === "meToMe" ? account.address : toAddress,
            value: 0n,
            data: stringToHex(inscription),
            ...(fastMode
              ? {
                  nonce: nonces[index] + count,
                }
              : {}),
            ...(gas > 0
              ? {
                    gasPrice: gasRadio === "all" ? parseEther(gas.toString(), "gwei") : undefined,
                    maxPriorityFeePerGas: gasRadio === "tip" ? parseEther(gas.toString(), "gwei") : undefined,
                }
              : {}),
          });
        }),
      ).then((results) => {
        results.forEach((result, index) => {
          const address = handleAddress(accounts[index].address);
          if (result.status === "fulfilled") {
            pushLog(`${address} ${result.value}`, "success");
            setSuccessCount((count) => count + 1);
          }
          if (result.status === "rejected") {
            const e = result.reason as SendTransactionErrorType;
            let msg = `${e.name as string}: `;
            if (e.name === "TransactionExecutionError") {
              msg += e.details;

              if (fastMode && e.details === "nonce too low") {
                msg += ", 可能是 nonce 错乱了, 正在重置...";

                setPause(true);
                getNonces().then(() => {
                  setPause(false);
                });
              }
            }
            if (e.name === "Error") {
              msg += e.message;
            }
            pushLog(msg, "error");
          }
        });
      });
    },
    running && !pause ? delay : null,
    fastMode,
  );

  const run = useCallback(() => {
    if (privateKeys.length === 0) {
      pushLog("没有私钥", "error");
      setRunning(false);
      return;
    }

    if (radio === "manyToOne" && !toAddress) {
      pushLog("没有地址", "error");
      setRunning(false);
      return;
    }

    if (!inscription) {
      pushLog("没有铭文", "error");
      setRunning(false);
      return;
    }

    setRunning(true);
  }, [privateKeys.length, toAddress, inscription, radio]);

  return (
    <div className="flex flex-col gap-4">
      {/* 省略了其他UI部分，应按需添加 */}
      
      {/* RPC输入框 */}
      <div className="flex flex-col gap-2">
        <span>
          RPC (选填, 默认公共有瓶颈经常失败, 最好用付费的, http 或者 ws 都可以):
        </span>
        <TextField
          size="small"
          placeholder="RPC"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value.trim();
            setRpc(text);
          }}
        />
      </div>
      
      {/* “额外矿工小费”和“总 gas”选择 */}
      <RadioGroup
        row
        value={gasRadio}
        onChange={(e) => {
          const value = e.target.value as GasRadio;
          setGasRadio(value);
        }}
      >
        <FormControlLabel
          value="tip"
          control={<Radio />}
          label="额外矿工小费"
          disabled={running}
        />
        <FormControlLabel
          value="all"
          control={<Radio />}
          label="总 gas"
          disabled={running}
        />
      </RadioGroup>

      {/* “额外矿工小费”和“总 gas”输入框 */}
      <div className="flex flex-col gap-2">
        <span>{gasRadio === "tip" ? "额外矿工小费" : "总 gas"} (选填):</span>
        <TextField
          type="number"
          size="small"
          placeholder={`${gasRadio === "tip" ? "默认 0" : "默认最新"}, 单位 gwei，例子: 10`}
          disabled={running}
          onChange={(e) => {
            const num = Number(e.target.value);
            !Number.isNaN(num) && num >= 0 && setGas(num);
          }}
        />
      </div>

      {/* 运行按钮 */}
      <Button
        variant="contained"
        color={running ? "error" : "success"}
        onClick={run}
      >
        {running ? "运行中" : "运行"}
      </Button>

      {/* 日志组件 */}
      <Log
        title={`日志（成功次数 => ${successCount}）:`}
        logs={logs}
        onClear={() => setLogs([])}
      />

    </div>
  );
}
