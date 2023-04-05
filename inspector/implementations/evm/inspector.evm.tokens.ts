import BigNumber from 'bignumber.js';

import { Injectable } from '@nestjs/common';

import Web3ProxyService from '@libs/web3/web3.proxy/web3.proxy.service';

import ContractRepository from '@gateway/database/repositories/contract.repository';
import ChainRepository from '@gateway/database/repositories/chain.repository';

import { ContractType } from '@gateway/database/entities/contract.entity';

import {
  IParseResult,
  ITransactionScanResult,
  IValidateResponse,
} from '../inspector.abstract';

import InspectorEvmAbstract, {
  IInspectorEvmTransaction,
} from './inspector.evm.abstract';

const TRANSFER = '0xa9059cbb';

@Injectable()
export default class InspectorEvmTokens extends InspectorEvmAbstract {
  private readonly _contractRepository: ContractRepository;

  constructor(
    web3: Web3ProxyService,
    chainRepository: ChainRepository,
    contractRepository: ContractRepository,
  ) {
    super(web3, chainRepository);
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
    transaction: IInspectorEvmTransaction,
  ): Promise<IParseResult> {
    if (transaction.input === '0x') {
      return null;
    }

    const method = transaction.input.slice(0, 10);

    if (method !== TRANSFER) {
      return null;
    }

    const contractAddress = transaction.to.toLowerCase();

    const contract = await this._contractRepository.findOne({
      where: {
        address: contractAddress,
        chain_id: transaction.chainId,
      },
    });

    if (!contract || contract.type !== ContractType.TOKEN) {
      return null;
    }

    const decodedInput = this._web3.decodeParameters(
      [
        {
          type: 'address',
          name: 'address',
        },
        {
          type: 'uint256',
          name: 'amount',
        },
      ],
      transaction.input,
    );

    if (!decodedInput) {
      return null;
    }

    const to = decodedInput.address.toLowerCase();

    const amount = new BigNumber(decodedInput.amount)
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
