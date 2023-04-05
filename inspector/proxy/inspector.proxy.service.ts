import { Injectable } from '@nestjs/common';

import Chain from '@gateway/database/entities/chains.entity';

import InspectorProxyNetworks from './networks/inspector.proxy.networks';

import {
  ITransactionScanResult,
  IValidateResponse,
} from '../implementations/inspector.abstract';

@Injectable()
export default class InspectorProxyService {
  private readonly _proxies: InspectorProxyNetworks[];

  constructor(...proxies: InspectorProxyNetworks[]) {
    this._proxies = proxies;
  }

  async validate(data: ITransactionScanResult): Promise<IValidateResponse> {
    for (const proxy of this._proxies) {
      const response = await proxy.validate(data);

      if (response) {
        return response;
      }
    }
  }

  async scan(
    operationId: number,
    hash: string,
  ): Promise<ITransactionScanResult> {
    for (const proxy of this._proxies) {
      const data = await proxy.scan(operationId, hash);

      if (data) {
        return data;
      }
    }
  }

  addChain(chain: Chain) {
    for (const proxy of this._proxies) {
      proxy.addChain(chain);
    }
  }
}
