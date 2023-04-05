import { Global, Module } from '@nestjs/common';

import InspectorRecorderService from './inspector.recorder.service';

@Global()
@Module({
  providers: [InspectorRecorderService],
  exports: [InspectorRecorderService],
})
export default class InspectorRecorderModule {}
