import { Inject, Injectable } from '@nestjs/common';

import { TransactionStatus } from '@libs/types';
import { GatewayTypes } from '@libs/broker/types';

import GatewayBrokerProducer from '@gateway/broker/gateway/gateway.producer';

import { ITransactionScanResult } from '../implementations/inspector.abstract';

export type NotifyData =
  | ITransactionScanResult
  | {
      id: number;
      hashIn: string;
      hashOut: string;
      status: TransactionStatus;
    };

@Injectable()
export default class InspectorNotifierService {
  @Inject()
  private readonly _broker: GatewayBrokerProducer;

  async notify(result: NotifyData): Promise<void> {
    const message: GatewayTypes.Scan.ITransactionScanResult = {
      ...result,
    };

    await this._broker.onScanTransactionResult(message);
  }
}
