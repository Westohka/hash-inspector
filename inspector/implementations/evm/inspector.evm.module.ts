import { DynamicModule, Global, Module, Type } from '@nestjs/common';

import { Web3ProxyModule } from '@libs/web3';

import InspectorProxyModule, {
  IInspectorProxyConfig,
} from '@gateway/inspector/proxy/inspector.proxy.module';

import InspectorEvmAbstract from './inspector.evm.abstract';
import InspectorEvmService from './inspector.evm.service';

export interface IInspectorEvmConfig extends IInspectorProxyConfig {
  inspectors: Type<InspectorEvmAbstract>[];
}

@Global()
@Module({})
export default class InspectorEvmModule extends InspectorProxyModule {
  static forRoot(options: IInspectorEvmConfig): DynamicModule {
    if (!options.inject) {
      options.inject = [];
    }

    const web3Module = Web3ProxyModule.forRoot({
      chains: [],
    });

    options.inject.push(web3Module);

    return super.forRoot({
      ...options,
      replacement: InspectorEvmService,
    });
  }
}
