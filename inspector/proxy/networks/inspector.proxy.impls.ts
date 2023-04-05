import { Injectable } from '@nestjs/common';

import InspectorAbstract from '../../implementations/inspector.abstract';
import {
  ITransactionScanResult,
  IValidateResponse,
} from '../../implementations/inspector.abstract';

@Injectable()
export default class InspectorProxyImpls {
  private readonly _inspectors: InspectorAbstract[];

  constructor(...inspectors: InspectorAbstract[]) {
    this._inspectors = inspectors;
  }

  async validate(data: ITransactionScanResult): Promise<IValidateResponse> {
    for (const inspector of this._inspectors) {
      const response = await inspector.validate(data);

      if (response) {
        return response;
      }
    }

    return null;
  }

  async scan(
    operationId: number,
    hash: string,
    chainId: number,
  ): Promise<ITransactionScanResult> {
    for (const inspector of this._inspectors) {
      const data = await inspector.scan(operationId, hash, chainId);

      if (data) {
        return data;
      }
    }

    return null;
  }
}
