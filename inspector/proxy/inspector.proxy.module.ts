import {
  DynamicModule,
  FactoryProvider,
  Global,
  Inject,
  Module,
  OnModuleInit,
} from '@nestjs/common';

import ChainRepository from '@gateway/database/repositories/chain.repository';

import InspectorProxyNetworks from './networks/inspector.proxy.networks';
import InspectorProxyService from './inspector.proxy.service';

export interface IInspectorFactoryConfig {
  modules: DynamicModule[];
}

/**
 * InspectorProxyModule - module for register all
 * inspectors services in ony entrypoint.
 *
 * Concept:
 * 1. Receive request for scan transaction with hash and chain.
 * 2. Find InspectorProxyNetworks in map by chain key.
 * 3. Try parse transaction info with InspectorProxyImpls.
 */

@Global()
@Module({})
export default class InspectorProxyModule implements OnModuleInit {
  @Inject()
  private readonly _service: InspectorProxyService;
  @Inject()
  private readonly _chainRepository: ChainRepository;

  static forRoot(options: IInspectorFactoryConfig): DynamicModule {
    const tokens = [];
    const imports: DynamicModule[] = [];

    for (const module of options.modules) {
      const [proxyService] = module.exports;

      tokens.push(proxyService);
      imports.push(module);
    }

    const service: FactoryProvider = {
      provide: InspectorProxyService,
      useFactory: (...inspectors: InspectorProxyNetworks[]) => {
        return new InspectorProxyService(...inspectors);
      },
      inject: tokens,
    };

    return {
      imports,
      providers: [service],
      module: InspectorProxyModule,
      exports: [service],
    };
  }

  async onModuleInit() {
    const chains = await this._chainRepository.find();

    for (const chain of chains) {
      this._service.addChain(chain);
    }
  }
}
