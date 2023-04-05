import BigNumber from 'bignumber.js';

import { Injectable } from '@nestjs/common';

import { TransactionStatus } from '@libs/types';

import Utils from '@libs/utils/utils';

import Web3ProxyService from '@libs/web3/web3.proxy/web3.proxy.service';
import { ITransaction } from '@libs/web3/web3.constants';

import ChainRepository from '@gateway/database/repositories/chain.repository';

import InspectorAbstract, {
  IParseResult,
  ITransactionScanResult,
  IValidateResponse,
} from '../inspector.abstract';

export interface IInspectorEvmTransaction extends ITransaction {
  chainId: number;
}

@Injectable()
export default abstract class InspectorEvmAbstract extends InspectorAbstract {
  protected readonly _web3: Web3ProxyService;

  protected constructor(
    web3: Web3ProxyService,
    chainRepository: ChainRepository,
  ) {
    super(chainRepository);
    this._web3 = web3;
  }

  private _isHash(hash: string) {
    const isHash =
      typeof hash === 'string' && hash.length === 66 && Utils.isHexStrict(hash);
    return isHash;
  }

  /**
   * Validate transaction status and confirmations.
   * Return status and effective network fee.
   */

  async validate(data: ITransactionScanResult): Promise<IValidateResponse> {
    const response: IValidateResponse = {
      status: TransactionStatus.REJECTED,
      networkFee: '0',
      blockNumber: data.blockNumber,
      hashOut: data.hashIn,
      amountOut: data.amountOut,
    };

    const receipt = await this._web3.getTransactionReceipt(
      data.chainInId,
      data.hashIn,
    );

    if (!receipt) {
      return response;
    }

    const chain = await this.chain(data.chainInId);

    const networkFeeBN = new BigNumber(receipt.gasUsed)
      .multipliedBy(receipt.effectiveGasPrice)
      .toFixed(0, BigNumber.ROUND_DOWN);

    const decimal = chain.decimal;
    const networkFee = new BigNumber(networkFeeBN)
      .shiftedBy(-decimal)
      .toString();

    response.networkFee = networkFee;

    if (!receipt.status) {
      response.status = TransactionStatus.REJECTED;
      return response;
    }

    const blockHeight = await this._web3.getBlockHeight(data.chainInId);
    const confirmations = blockHeight - receipt.blockNumber;

    response.status =
      confirmations >= chain.confirmations_min
        ? TransactionStatus.FINISHED
        : TransactionStatus.PENDING;

    return response;
  }

  /**
   * Entrypoint for scan transaction
   */

  async scan(
    id: number,
    hash: string,
    chainId: number,
  ): Promise<ITransactionScanResult> {
    const isHex = this._isHash(hash);

    if (!isHex) {
      return null;
    }

    const data = await this._web3.getTransaction(chainId, hash);

    if (!data) {
      return null;
    }

    const parseResult = await this.parse({
      ...data,
      chainId,
    });

    if (!parseResult) {
      return null;
    }

    const from = data.from.toLowerCase();

    const response: ITransactionScanResult = {
      id,
      hashIn: hash,
      hashOut: hash,
      from,
      blockNumber: data.blockNumber,
      chainInId: chainId,
      status: TransactionStatus.PENDING,
      ...parseResult,
      networkFee: '0',
    };

    const validate = await this.validate({
      ...response,
    });

    response.hashOut = validate.hashOut;
    response.amountOut = validate.amountOut;
    response.blockNumber = validate.blockNumber;
    response.networkFee = validate.networkFee;
    response.status = validate.status;

    return response;
  }

  protected abstract override parse(
    transaction: IInspectorEvmTransaction,
  ): Promise<IParseResult>;
}
