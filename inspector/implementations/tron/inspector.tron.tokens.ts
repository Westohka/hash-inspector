import BigNumber from 'bignumber.js';

import { Injectable } from '@nestjs/common';

import AddressFormatter from '@libs/utils/address_formatter';

import TronProxyService from '@libs/tron/tron.proxy/tron.proxy.service';

import ContractRepository from '@gateway/database/repositories/contract.repository';
import ChainRepository from '@gateway/database/repositories/chain.repository';

import { ContractType } from '@gateway/database/entities/contract.entity';

import {
  IParseResult,
  ITransactionScanResult,
  IValidateResponse,
} from '../inspector.abstract';

import InspectorTronAbstract, {
  IInspectorTronTransaction,
} from './inspector.tron.abstract';

const TRANSFER = 'a9059cbb';

@Injectable()
export default class InspectorTronTokens extends InspectorTronAbstract {
  private readonly _contractRepository: ContractRepository;

  constructor(
    tron: TronProxyService,
    chainRepository: ChainRepository,
    contractRepository: ContractRepository,
  ) {
    super(tron, chainRepository);
    this._contractRepository = contractRepository;
  }

  override async validate(
    data: ITransactionScanResult,
  ): Promise<IValidateResponse> {
    if (!data.contractAddress) {
      return null;
    }

    const contract = await this._contractRepository.findOne({
      where: {
        address: data.contractAddress,
        chain_id: data.chainInId,
      },
    });

    if (!contract || contract.type !== ContractType.TOKEN) {
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
      transactionData.type !== 'TriggerSmartContract' ||
      !transactionParameters.contract_address ||
      !transactionParameters.data
    ) {
      return null;
    }

    const method = transactionParameters.data.slice(0, 8);

    if (method !== TRANSFER) {
      return null;
    }

    const contractAddress = AddressFormatter.format(
      transactionParameters.contract_address,
    );

    const contract = await this._contractRepository.findOne({
      where: {
        address: contractAddress,
        chain_id: transaction.chainId,
      },
    });

    if (!contract || contract.type !== ContractType.TOKEN) {
      return null;
    }

    const decodedInput = this._tron.decodeParams(
      ['address', 'uint256'],
      '0x' + transactionParameters.data,
      true,
    );

    if (!decodedInput) {
      return null;
    }

    const to = AddressFormatter.format(decodedInput[0]);

    const amount = new BigNumber(decodedInput[1])
      .shiftedBy(-contract.decimal)
      .toString();

    const response: IParseResult = {
      chainOutId: transaction.chainId,
      to,
      amount,
      amountIn: amount,
      amountOut: amount,
      convertationFee: '0',
      currencyIn: contract.address,
      currencyOut: contract.address,
      contractAddress,
    };

    return response;
  }
}
