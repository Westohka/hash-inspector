import Chain from '@gateway/database/entities/chains.entity';
import { Inject, Injectable } from '@nestjs/common';

import {
  ITransactionScanResult,
  IValidateResponse,
} from '../../implementations/inspector.abstract';

import InspectorProxyImpls from './inspector.proxy.impls';

@Injectable()
export default class InspectorProxyNetworks {
  private readonly _chains: number[] = [];

  @Inject()
  private readonly _proxy: InspectorProxyImpls;

  async validate(data: ITransactionScanResult): Promise<IValidateResponse> {
    const isChainExists = this._chains.includes(data.chainInId);

    if (!isChainExists) {
      return null;
    }

    const response = await this._proxy.validate(data);
    return response;
  }

  async scan(
    operationId: number,
    hash: string,
  ): Promise<ITransactionScanResult> {
    for (const chain of this._chains) {
      const data = await this._proxy.scan(operationId, hash, chain);

      if (data) {
        return data;
      }
    }

    return null;
  }

  addChain(chain: Chain) {
    this._chains.push(chain.id);
  }
}
