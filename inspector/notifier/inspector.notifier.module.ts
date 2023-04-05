import { Global, Module } from '@nestjs/common';

import InspectorNotifierService from './inspector.notifier.service';

@Global()
@Module({
  providers: [InspectorNotifierService],
  exports: [InspectorNotifierService],
})
export default class InspectorNotifierModule {}
