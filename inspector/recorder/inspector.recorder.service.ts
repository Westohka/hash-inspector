import { Inject, Injectable } from '@nestjs/common';

import TransactionRepository from '@gateway/database/repositories/transaction.repository';
import ContractRepository from '@gateway/database/repositories/contract.repository';

import Transaction from '@gateway/database/entities/transaction.entity';
import { IInspectorMeta } from '@gateway/database/entities/transaction.entity';

import { ITransactionScanResult } from '../implementations/inspector.abstract';

@Injectable()
export default class InspectorRecorderService {
  @Inject()
  private readonly _transactionRepository: TransactionRepository;

  @Inject()
  private readonly _contractRepository: ContractRepository;

  async record(result: ITransactionScanResult): Promise<Transaction> {
    const meta: IInspectorMeta = {
      amountIn: result.amountIn,
      amountOut: result.amountOut,
      convertationFee: result.convertationFee,
      currencyIn: result.currencyIn,
      currencyOut: result.currencyOut,
      hashOut: result.hashOut,
      chainOutId: result.chainOutId,
    };

    const contract = result.contractAddress
      ? await this._contractRepository.findOne({
          where: {
            address: result.contractAddress,
            chain_id: result.chainInId,
          },
        })
      : null;

    const transaction = this._transactionRepository.create({
      hash: result.hashIn,
      chain_id: result.chainInId,
      block_number: result.blockNumber,
      from: result.from,
      to: result.to,
      amount: result.amount,
      fee: result.networkFee,
      contract_id: result.contractAddress ? contract.id : null,
      meta,
      status: result.status,
    });

    const isExists = await this._transactionRepository.findOne({
      where: {
        hash: result.hashIn,
        chain_id: result.chainInId,
      },
    });

    if (isExists) {
      transaction.id = isExists.id;
    }

    await this._transactionRepository.save(transaction);
    return transaction;
  }
}
