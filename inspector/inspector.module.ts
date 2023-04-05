import { Global, Module } from '@nestjs/common';

import InspectorProxyModule from './proxy/inspector.proxy.module';

import InspectorRecorderModule from './recorder/inspector.recorder.module';
import InspectorNotifierModule from './notifier/inspector.notifier.module';

// EVM chains

import InspectorEvmModule from './implementations/evm/inspector.evm.module';
import InspectorEvmNative from './implementations/evm/inspector.evm.native';
import InspectorEvmTokens from './implementations/evm/inspector.evm.tokens';

// Tron chains

import InspectorTronModule from './implementations/tron/inspector.tron.module';
import InspectorTronNative from './implementations/tron/inspector.tron.native';
import InspectorTronTokens from './implementations/tron/inspector.tron.tokens';

@Global()
@Module({
  imports: [
    InspectorProxyModule.forRoot({
      modules: [
        InspectorEvmModule.forRoot({
          inspectors: [
            InspectorEvmNative,
            InspectorEvmTokens,
          ],
          inject: [],
        }),
        InspectorTronModule.forRoot({
          inspectors: [
            InspectorTronNative,
            InspectorTronTokens,
          ],
          inject: [],
        }),
      ],
    }),
    InspectorRecorderModule,
    InspectorNotifierModule,
  ],
})
export default class InspectorModule {}
