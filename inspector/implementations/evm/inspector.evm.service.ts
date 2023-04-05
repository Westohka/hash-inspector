import { Inject, Injectable } from '@nestjs/common';

import { ChainType } from '@libs/types';

import Web3ProxyService from '@libs/web3/web3.proxy/web3.proxy.service';
import Web3Service from '@libs/web3/web3.service';

import Chain from '@gateway/database/entities/chains.entity';

import InspectorProxyNetworks from '@gateway/inspector/proxy/inspector.proxy.networks';

@Injectable()
export default class InspectorEvmService extends InspectorProxyNetworks {
  @Inject()
  private readonly _web3: Web3ProxyService;

  override addChain(chain: Chain) {
    if (chain.type !== ChainType.EVM) {
      return;
    }

    const web3 = new Web3Service({
      chainId: chain.id,
      provider: chain.data.provider,
    });

    this._web3.addWeb3(web3);
    super.addChain(chain);
  }
}
