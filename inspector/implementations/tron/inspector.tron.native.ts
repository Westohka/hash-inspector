import BigNumber from 'bignumber.js';

import { Injectable } from '@nestjs/common';

import { NATIVE_CURRENCY_ADDRESS } from '@libs/types';

import AddressFormatter from '@libs/utils/address_formatter';

import TronProxyService from '@libs/tron/tron.proxy/tron.proxy.service';

import ChainRepository from '@gateway/database/repositories/chain.repository';

import {
  IParseResult,
  ITransactionScanResult,
  IValidateResponse,
} from '../inspector.abstract';

import InspectorTronAbstract, {
  IInspectorTronTransaction,
} from './inspector.tron.abstract';

@Injectable()
export default class InspectorTronNative extends InspectorTronAbstract {
  constructor(tron: TronProxyService, chainRepository: ChainRepository) {
    super(tron, chainRepository);
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
    transaction: IInspectorTronTransaction,
  ): Promise<IParseResult> {
    const transactionData = transaction.raw_data.contract[0];
    const transactionParameters = transactionData.parameter.value;

    if (
      transactionData.type !== 'TransferContract' ||
      transactionParameters.contract_address ||
      transactionParameters.data
    ) {
      return null;
    }

    const to = AddressFormatter.format(transactionParameters.to_address);

    const chain = await this.chain(transaction.chainId);
    const decimal = chain.decimal;
    const amount = new BigNumber(transactionParameters.amount)
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
