import { Injectable } from '@nestjs/common';

import { TransactionStatus } from '@libs/types';

import ChainRepository from '@gateway/database/repositories/chain.repository';
import Chain from '@gateway/database/entities/chains.entity';

export interface IParseResult {
  amount: string;
  amountIn: string;
  amountOut: string;
  convertationFee: string;
  to: string;
  currencyIn: string;
  currencyOut: string;
  contractAddress?: string;
  chainOutId: number;
}

export interface ITransactionScanResult extends IParseResult {
  id: number;
  hashIn: string;
  hashOut: string;
  blockNumber: number;
  chainInId: number;
  from: string;
  networkFee: string;
  status: TransactionStatus;
}

export interface IValidateResponse {
  status: TransactionStatus;
  networkFee: string;
  blockNumber: number;
  hashOut: string;
  amountOut: string;
}

@Injectable()
export default abstract class InspectorAbstract {
  private static readonly _chains = new Map<number, Chain>();

  protected readonly _chainRepository: ChainRepository;

  constructor(chainRepository: ChainRepository) {
    this._chainRepository = chainRepository;
  }

  protected async chain(chainId: number) {
    if (!InspectorAbstract._chains.has(chainId)) {
      const chain = await this._chainRepository.findOne(chainId);
      InspectorAbstract._chains.set(chainId, chain);
    }

    return InspectorAbstract._chains.get(chainId);
  }

  /**
   * Validate transaction status and confirmations.
   * Return status and effective network fee.
   */

  abstract validate(data: ITransactionScanResult): Promise<IValidateResponse>;

  /**
   * Entrypoint for scan transaction
   */

  abstract scan(
    id: number,
    hash: string,
    chainId: number,
  ): Promise<ITransactionScanResult>;

  /**
   * Parse data logic. Must be specified by inspector child.
   */

  protected abstract parse(transaction: any): Promise<IParseResult>;
}
