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
    async () => {
      const results = await Promise.allSettled(
        accounts.map((account) => {
          return client.sendTransaction({
            account,
            to: radio === "meToMe" ? account.address : toAddress,
            value: 0n,
            data: stringToHex(inscription),
           ...(gas > 0
              ? gasRadio === "all"
                ? {
                    gasPrice: parseEther(gas.toString(), "gwei"),
                  }
                : {
                    maxPriorityFeePerGas: parseEther(gas.toString(), "gwei"),
                  }
              : {}),
          });
        }),
      );
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
            msg = msg + e.details;
          }
          if (e.name == "Error") {
            msg = msg + e.message;
          }
          setLogs((logs) => [handleLog(`${address} ${msg}`, "error"), ...logs]);
        }
      });
    },
    running ? delay : null,
  );

  const run = useCallback(async () => {
    if (privateKeys.length === 0) {
      setLogs((logs) => [handleLog("No private keys", "error"), ...logs]);
      setRunning(false);
      return;
    }

    if (radio === "manyToOne" && !toAddress) {
      setLogs((logs) => [handleLog("No address", "error"), ...logs]);
      setRunning(false);
      return;
    }

    if (!inscription) {
      setLogs((logs) => [handleLog("No inscription", "error"), ...logs]);
      setRunning(false);
      return;
    }

    try {
      if (fastMode) {
        await getNonces();
      }
      setRunning(true);
    } catch {
      pushLog("Failed to get nonce", "error");
    }
  }, [
    fastMode,
    getNonces,
    inscription,
    privateKeys.length,
    pushLog,
    radio,
    toAddress,
  ]);

  return (
    <div className=" flex flex-col gap-4">
      <div className=" flex flex-col gap-2">
        <span>Chain (Choose the chain for inscription):</span>
        <TextField
          select
          defaultValue="eth"
          size="small"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value as ChainKey;
            setChain(inscriptionChains[text]);
          }}
        >
          {Object.entries(inscriptionChains).map(([key, chain]) => (
            <MenuItem
              key={chain.id}
              value={key}
            >
              {chain.name}
            </MenuItem>
          ))}
        </TextField>
      </div>

      <div className=" flex flex-col gap-2">
        <span>Private Keys (Required, one per line):</span>
        <TextField
          multiline
          minRows={2}
          size="small"
          placeholder="Private keys, with or without 0x, the program will handle it"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            const lines = text.split("\n");
            const keys = lines
              .map((line) => {
                const key = line.trim();
                if (/^[a-fA-F0-9]{64}$/.test(key)) {
                  return `0x${key}`;
                }
                if (/^0x[a-fA-F0-9]{64}$/.test(key)) {
                  return key as Hex;
                }
              })
              .filter((x) => x) as Hex[];
            setPrivateKeys(keys);
          }}
        />
      </div>

      <RadioGroup
        row
        defaultValue="meToMe"
        onChange={(e) => {
          const value = e.target.value as RadioType;
          setRadio(value);
        }}
      >
        <FormControlLabel
          value="meToMe"
          control={<Radio />}
          label="Self transfer"
          disabled={running}
        />
        <FormControlLabel
          value="manyToOne"
          control={<Radio />}
          label="Many to one"
          disabled={running}
        />
      </RadioGroup>

      {radio === "manyToOne" && (
        <div className=" flex flex-col gap-2">
          <span>Address to transfer to (Required):</span>
          <TextField
            size="small"
            placeholder="Address"
            disabled={running}
            onChange={(e) => {
              const text = e.target.value;
              isAddress(text) && setToAddress(text);
            }}
          />
        </div>
      )}

      <div className=" flex flex-col gap-2">
        <span>Inscription (Required, original inscription, not the hexadecimal encoded):</span>
        <TextField
          size="small"
          placeholder={`Inscription, double check to avoid errors, example:\n${example}`}
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            setInscription(text.trim());
          }}
        />
      </div>

      <div className=" flex flex-col gap-2">
        <span>
          RPC (Optional, default public ones often fail, better use paid ones, both http and ws are fine):
        </span>
        <TextField
          size="small"
          placeholder="RPC"
          disabled={running}
          onChange={(e) => {
            const text = e.target.value;
            setRpc(text);
          }}
        />
      </div>
      <RadioGroup
        row
        defaultValue="tip"
        onChange={(e) => {
          const value = e.target.value as GasRadio;
          setGasRadio(value);
        }}
      >
        <FormControlLabel
          value="tip"
          control={<Radio />}
          label="Extra miner tip"
          disabled={running}
        />
        <FormControlLabel
          value="all"
          control={<Radio />}
          label="Total gas"
          disabled={running}
        />
      </RadioGroup>

      <div className="flex flex-col gap-2">
  <span>{gasRadio === "tip" ? "Extra Miner Tip" : "Total Gas"} (Optional):</span>
    <TextField
      type="number"
      size="small"
      placeholder={`${
        gasRadio === "tip" ? "Default 0" : "Default Latest"
      }, unit gwei, example: 10`}
      disabled={running}
      onChange={(e) => {
        const num = Number(e.target.value);
        !Number.isNaN(num) && num >= 0 && setGas(num);
      }}
    />
</div>

<div className="flex flex-col gap-2">
  <span>
    Interval Between Transactions (Optional, Minimum 0ms for Normal Mode, Minimum 100ms for Fast Mode):
  </span>
  <TextField
    type="number"
    size="small"
    placeholder="Default 0ms for Normal Mode, Default 100ms for Fast Mode"
    disabled={running}
    onChange={(e) => {
      const num = Number(e.target.value);
      !Number.isNaN(num) && num >= 0 && setDelay(num);
    }}
  />
</div>

<FormControlLabel
  control={
    <Switch
      disabled={running}
      onChange={(e) => {
        setFastMode(e.target.checked);
      }}
    />
  }
  label="Fast Mode (Do not wait for confirmation of previous transaction, Minimum Interval 100ms, May cause nonce disorder, Use with caution, Suitable for players with excellent RPC)"
/>

<Button
  variant="contained"
  color={running ? "error" : "success"}
  onClick={() => {
    if (!running) {
      run();
    } else {
      setRunning(false);
    }
  }}
>
  {running ? "Running" : "Run"}
</Button>

<Log
  title={`Logs (Success Count => ${successCount}):`}
  logs={logs}
  onClear={() => {
    setLogs([]);
  }}
/>
</div>
);
}
