import {
  ClassProvider,
  DynamicModule,
  FactoryProvider,
  ForwardReference,
  Global,
  Module,
  Type,
} from '@nestjs/common';

import InspectorAbstract from '@gateway/inspector/implementations/inspector.abstract';

import InspectorProxyImpls from './inspector.proxy.impls';
import InspectorProxyNetworks from './inspector.proxy.networks';

export interface IInspectorProxyNetworksConfig {
  inject?: Array<
    Type<any> | DynamicModule | Promise<DynamicModule> | ForwardReference
  >;
  inspectors: Type<InspectorAbstract>[];
  replacement?: typeof InspectorProxyNetworks;
}

@Global()
@Module({})
export default class InspectorProxyNetworksModule {
  static forRoot(options: IInspectorProxyNetworksConfig): DynamicModule {
    if (!options.inject) {
      options.inject = [];
    }

    // Create inspectors providers

    const inspectors: ClassProvider[] = [];
    const inspectorsTokens: string[] = [];

    for (const inspector of options.inspectors) {
      inspectors.push({
        provide: inspector.name,
        useClass: inspector,
      });

      inspectorsTokens.push(inspector.name);
    }

    // Create proxy for implementations

    const proxyImpls: FactoryProvider = {
      provide: InspectorProxyImpls,
      useFactory: (...inspectors: InspectorAbstract[]) => {
        return new InspectorProxyImpls(...inspectors);
      },
      inject: [...inspectorsTokens],
    };

    const service = options.replacement
      ? options.replacement
      : InspectorProxyNetworks;

    return {
      imports: options.inject,
      providers: [...inspectors, proxyImpls, service],
      module: InspectorProxyNetworksModule,
      exports: [service],
    };
  }
}
