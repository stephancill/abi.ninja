import { useEffect, useState } from "react";
import { InheritanceTooltip } from "./InheritanceTooltip";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Abi, AbiFunction } from "abitype";
import { Address, TransactionReceipt, encodeFunctionData } from "viem";
import { useAccount, useConfig, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { CheckCircleIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import {
  ContractInput,
  IntegerInput,
  TxReceipt,
  getFunctionInputKey,
  getInitialFormState,
  getParsedContractFunctionArgs,
  transformAbiFunction,
} from "~~/components/scaffold-eth";
import { useTransactor } from "~~/hooks/scaffold-eth";
import { useGlobalState } from "~~/services/store/store";
import { getParsedError, notification } from "~~/utils/scaffold-eth";
import { simulateContractWriteAndNotifyError } from "~~/utils/scaffold-eth/contract";

type WriteOnlyFunctionFormProps = {
  abi: Abi;
  abiFunction: AbiFunction;
  onChange: () => void;
  contractAddress: Address;
  inheritedFrom?: string;
};

export const WriteOnlyFunctionForm = ({
  abi,
  abiFunction,
  onChange,
  contractAddress,
  inheritedFrom,
}: WriteOnlyFunctionFormProps) => {
  const mainChainId = useGlobalState(state => state.targetNetwork.id);
  const [form, setForm] = useState<Record<string, any>>(() => getInitialFormState(abiFunction));
  const [txValue, setTxValue] = useState<string>("");
  const { chain } = useAccount();
  const writeTxn = useTransactor();
  const { address: connectedAddress } = useAccount();
  const { openConnectModal } = useConnectModal();
  const wrongNetwork = !chain || chain?.id !== mainChainId;

  const { data: result, isPending, writeContractAsync } = useWriteContract();

  const wagmiConfig = useConfig();

  const [calldataCopied, setCalldataCopied] = useState(false);

  const handleWrite = async () => {
    if (writeContractAsync) {
      try {
        const writeContractObj = {
          address: contractAddress,
          functionName: abiFunction.name,
          abi: abi,
          args: getParsedContractFunctionArgs(form),
          value: BigInt(txValue),
        };
        await simulateContractWriteAndNotifyError({ wagmiConfig, writeContractParams: writeContractObj });

        const makeWriteWithParams = () => writeContractAsync(writeContractObj);
        await writeTxn(makeWriteWithParams);
        onChange();
      } catch (e: any) {
        console.error("⚡️ ~ file: WriteOnlyFunctionForm.tsx:handleWrite ~ error", e);
      }
    }
  };

  const [displayedTxResult, setDisplayedTxResult] = useState<TransactionReceipt>();
  const { data: txResult } = useWaitForTransactionReceipt({
    hash: result,
  });
  useEffect(() => {
    setDisplayedTxResult(txResult);
  }, [txResult]);

  // TODO use `useMemo` to optimize also update in ReadOnlyFunctionForm
  const transformedFunction = transformAbiFunction(abiFunction);
  const inputs = transformedFunction.inputs.map((input, inputIndex) => {
    const key = getFunctionInputKey(abiFunction.name, input, inputIndex);
    return (
      <ContractInput
        key={key}
        setForm={updatedFormValue => {
          setDisplayedTxResult(undefined);
          setForm(updatedFormValue);
        }}
        form={form}
        stateObjectKey={key}
        paramType={input}
      />
    );
  });
  const zeroInputs = inputs.length === 0 && abiFunction.stateMutability !== "payable";

  const handleCopyCalldata = async () => {
    try {
      const calldata = encodeFunctionData({
        abi: abi,
        functionName: abiFunction.name,
        args: getParsedContractFunctionArgs(form),
      });
      await navigator.clipboard.writeText(calldata);
      setCalldataCopied(true);
      setTimeout(() => {
        setCalldataCopied(false);
      }, 800);
    } catch (e) {
      const errorMessage = getParsedError(e);
      console.error("Error copying calldata:", e);
      notification.error(errorMessage);
    }
  };

  return (
    <div className="py-5 space-y-3 first:pt-0 last:pb-1">
      <div className={`flex gap-3 ${zeroInputs ? "flex-row justify-between" : "flex-col"}`}>
        <p className="font-medium my-0 break-words">
          {abiFunction.name}
          <InheritanceTooltip inheritedFrom={inheritedFrom} />
        </p>
        {inputs}
        {abiFunction.stateMutability === "payable" ? (
          <div className="flex flex-col gap-1.5 w-full">
            <div className="flex items-center ml-2">
              <span className="text-xs font-medium mr-2 leading-none">payable value</span>
              <span className="block text-xs font-extralight leading-none">wei</span>
            </div>
            <IntegerInput
              value={txValue}
              onChange={updatedTxValue => {
                setDisplayedTxResult(undefined);
                setTxValue(updatedTxValue);
              }}
              placeholder="value (wei)"
            />
          </div>
        ) : null}
        <div className={`flex justify-between gap-2 ${zeroInputs ? "mt-8" : "mt-0"}`}>
          {!zeroInputs && (
            <div className="flex-grow basis-0">
              {displayedTxResult ? <TxReceipt txResult={displayedTxResult} /> : null}
            </div>
          )}
          <div className="flex gap-2">
            <div className="tooltip tooltip-left" data-tip="Copy Calldata">
              <button className="btn btn-ghost btn-sm" onClick={handleCopyCalldata}>
                {calldataCopied ? (
                  <CheckCircleIcon
                    className="h-5 w-5 text-xl font-normal text-secondary-content cursor-pointer"
                    aria-hidden="true"
                  />
                ) : (
                  <DocumentDuplicateIcon className="h-5 w-5 text-xl font-normal text-secondary-content cursor-pointer" />
                )}
              </button>
            </div>
            {connectedAddress ? (
              <div
                className={`flex ${
                  wrongNetwork &&
                  "tooltip before:content-[attr(data-tip)] before:right-[-10px] before:left-auto before:transform-none"
                }`}
                data-tip={`${wrongNetwork && "Wrong network"}`}
              >
                <button className="btn btn-secondary btn-sm" disabled={wrongNetwork || isPending} onClick={handleWrite}>
                  {isPending && <span className="loading loading-spinner loading-xs"></span>}
                  Send 💸
                </button>
              </div>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={openConnectModal}>
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
      {zeroInputs && txResult ? (
        <div className="flex-grow basis-0">
          <TxReceipt txResult={txResult} />
        </div>
      ) : null}
    </div>
  );
};
