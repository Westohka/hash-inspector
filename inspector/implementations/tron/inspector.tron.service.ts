import { Inject, Injectable } from '@nestjs/common';

import { ChainType } from '@libs/types';

import TronProxyService from '@libs/tron/tron.proxy/tron.proxy.service';
import TronService from '@libs/tron/tron.service';

import Chain, {
  IChainDataTron,
} from '@gateway/database/entities/chains.entity';

import InspectorProxyNetworks from '@gateway/inspector/proxy/inspector.proxy.networks';

@Injectable()
export default class InspectorTronService extends InspectorProxyNetworks {
  @Inject()
  private readonly _tron: TronProxyService;

  override addChain(chain: Chain) {
    if (chain.type !== ChainType.TRON) {
      return;
    }

    const data = <IChainDataTron>chain.data;

    const tron = new TronService({
      chainId: chain.id,
      provider: data.provider,
      apiKey: data.apiKey,
    });

    this._tron.addTron(tron);
    super.addChain(chain);
  }
}
