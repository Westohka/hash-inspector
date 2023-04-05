import BigNumber from 'bignumber.js';

import { Injectable } from '@nestjs/common';

import { NATIVE_CURRENCY_ADDRESS } from '@libs/types';

import Web3ProxyService from '@libs/web3/web3.proxy/web3.proxy.service';

import ChainRepository from '@gateway/database/repositories/chain.repository';

import {
  IParseResult,
  ITransactionScanResult,
  IValidateResponse,
} from '../inspector.abstract';

import InspectorEvmAbstract, {
  IInspectorEvmTransaction,
} from './inspector.evm.abstract';

@Injectable()
export default class InspectorEvmNative extends InspectorEvmAbstract {
  constructor(web3: Web3ProxyService, chainRepository: ChainRepository) {
    super(web3, chainRepository);
  }

  override async validate(
    data: ITransactionScanResult,
  ): Promise<IValidateResponse> {
    if (data.contractAddress) {
      return null;
    }

    return super.validate(data);
  }

  override async parse(
    transaction: IInspectorEvmTransaction,
  ): Promise<IParseResult> {
    if (transaction.input !== '0x') {
      return null;
    }

    const to = transaction.to.toLowerCase();

    const chain = await this.chain(transaction.chainId);
    const decimal = chain.decimal;
    const amount = new BigNumber(transaction.value)
      .shiftedBy(-decimal)
      .toString();

    const response: IParseResult = {
      chainOutId: transaction.chainId,
      to,
      amount,
      amountIn: amount,
      amountOut: amount,
      convertationFee: '0',
      currencyIn: NATIVE_CURRENCY_ADDRESS,
      currencyOut: NATIVE_CURRENCY_ADDRESS,
    };

    return response;
  }
}
