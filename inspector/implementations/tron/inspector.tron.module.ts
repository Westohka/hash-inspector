import { DynamicModule, Global, Module, Type } from '@nestjs/common';

import { TronProxyModule } from '@libs/tron';

import InspectorProxyModule, {
  IInspectorProxyConfig,
} from '@gateway/inspector/proxy/inspector.proxy.module';

import InspectorTronAbstract from './inspector.tron.abstract';
import InspectorTronService from './inspector.tron.service';

export interface IInspectorTronConfig extends IInspectorProxyConfig {
  inspectors: Type<InspectorTronAbstract>[];
}

@Global()
@Module({})
export default class InspectorTronModule extends InspectorProxyModule {
  static forRoot(options: IInspectorTronConfig): DynamicModule {
    if (!options.inject) {
      options.inject = [];
    }

    const tronModule = TronProxyModule.forRoot({
      chains: [],
    });

    options.inject.push(tronModule);

    return super.forRoot({
      ...options,
      replacement: InspectorTronService,
    });
  }
}
