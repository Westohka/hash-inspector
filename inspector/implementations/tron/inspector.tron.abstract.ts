import BigNumber from 'bignumber.js';

import { Injectable } from '@nestjs/common';

import { TransactionStatus } from '@libs/types';

import Utils from '@libs/utils/utils';
import AddressFormatter from '@libs/utils/address_formatter';

import TronProxyService from '@libs/tron/tron.proxy/tron.proxy.service';
import { ITronTransaction, TronRetValues } from '@libs/tron/tron.constants';

import ChainRepository from '@gateway/database/repositories/chain.repository';

import InspectorAbstract, {
  IParseResult,
  ITransactionScanResult,
  IValidateResponse,
} from '../inspector.abstract';

export interface IInspectorTronTransaction extends ITronTransaction {
  chainId: number;
}

@Injectable()
export default abstract class InspectorTronAbstract extends InspectorAbstract {
  protected readonly _tron: TronProxyService;

  protected constructor(
    tron: TronProxyService,
    chainRepository: ChainRepository,
  ) {
    super(chainRepository);
    this._tron = tron;
  }

  private _isHash(hash: string) {
    const isHash =
      typeof hash === 'string' &&
      hash.length === 64 &&
      Utils.isHexStrict('0x' + hash);
    return isHash;
  }

  /**
   * Validate transaction status and confirmations.\
   * Return status and effective network fee.
   */

  async validate(data: ITransactionScanResult): Promise<IValidateResponse> {
    const response: IValidateResponse = {
      status: TransactionStatus.PENDING,
      networkFee: '0',
      blockNumber: 0,
      hashOut: data.hashIn,
      amountOut: data.amountOut,
    };

    const currentBlock = await this._tron.getCurrentBlock(data.chainInId);
    const currentBlockNumber = currentBlock.block_header.raw_data.number;

    const receipt = await this._tron.getTransactionInfo(
      data.chainInId,
      data.hashIn,
    );

    if (!receipt) {
      if (currentBlockNumber - data.blockNumber > 50) {
        response.status = TransactionStatus.REJECTED;
      }

      return response;
    }

    const chain = await this.chain(data.chainInId);

    const networkFeeBN = new BigNumber(receipt.fee ? receipt.fee : '0').toFixed(
      0,
      BigNumber.ROUND_DOWN,
    );

    const decimal = chain.decimal;
    const networkFee = new BigNumber(networkFeeBN)
      .shiftedBy(-decimal)
      .toString();

    response.networkFee = networkFee;
    response.blockNumber = receipt.blockNumber;

    const confirmations = currentBlockNumber - receipt.blockNumber;

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

    const data = await this._tron.getTransaction(chainId, hash);

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

    const currentBlock = await this._tron.getCurrentBlock(chainId);
    const currentBlockNumber = currentBlock.block_header.raw_data.number;

    const from = AddressFormatter.format(
      data.raw_data.contract[0].parameter.value.owner_address,
    );

    const response: ITransactionScanResult = {
      id,
      hashIn: hash,
      hashOut: hash,
      from,
      blockNumber: currentBlockNumber,
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

    if (data.ret[0].contractRet === TronRetValues.FAILED) {
      response.status = TransactionStatus.REJECTED;
    }

    return response;
  }

  protected abstract override parse(
    transaction: IInspectorTronTransaction,
  ): Promise<IParseResult>;
}
