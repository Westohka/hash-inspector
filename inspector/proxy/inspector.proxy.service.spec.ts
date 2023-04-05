import { TransactionStatus, ChainType } from '@libs/types';

import Utils from '@libs/utils/utils';

import TestAbstract from '@gateway_test/test.abstract';
import ApplicationTestModule from '@gateway_test/main.test';

import InspectorEvmService from '../implementations/evm/inspector.evm.service';
import InspectorTronService from '../implementations/tron/inspector.tron.service';

import { ITransactionScanResult } from '../implementations/inspector.abstract';

import InspectorProxyService from './inspector.proxy.service';

interface IScanOptions {
  chainType: ChainType;
}

class InspectorProxyServiceTest extends TestAbstract {
  // Services

  private _service: InspectorProxyService;

  private _serviceEVM: InspectorEvmService;
  private _serviceTron: InspectorTronService;

  run(): void {
    beforeAll(async () => {
      // Create application

      this._app = await ApplicationTestModule();

      // Services

      this._service = this._app.get<InspectorProxyService>(
        InspectorProxyService,
      );

      this._serviceEVM =
        this._app.get<InspectorEvmService>(InspectorEvmService);
      this._serviceTron =
        this._app.get<InspectorTronService>(InspectorTronService);
    });

    beforeEach(() => {
      jest.restoreAllMocks();
    });

    afterAll(async () => {
      await this._app.close();
    });

    describe('Inspector factory module', () => {
      describe('Scan', () => {
        this.scan({ chainType: ChainType.EVM });
        this.scan({ chainType: ChainType.TRON });
      });

      describe('Validate', () => {
        this.validate({ chainType: ChainType.EVM });
        this.validate({ chainType: ChainType.TRON });
      });
    });
  }

  scan(options: IScanOptions): void {
    const info = `Transaction scan in ${options.chainType} chain`;

    it(info, async () => {
      // Mock proxy services

      const responseEvm = <any>Utils.getUUID();

      jest.spyOn(this._serviceEVM, 'scan').mockImplementation(async () => {
        if (options.chainType === ChainType.EVM) {
          return responseEvm;
        }

        return null;
      });

      const responseTron = <any>Utils.getUUID();

      jest.spyOn(this._serviceTron, 'scan').mockImplementation(async () => {
        if (options.chainType === ChainType.TRON) {
          return responseTron;
        }

        return null;
      });

      // Testing

      const requestId = 100;
      const hash = Utils.getUUID();

      const result = await this._service.scan(requestId, hash);

      if (options.chainType === ChainType.EVM) {
        expect(result).toEqual(responseEvm);
      } else if (options.chainType === ChainType.TRON) {
        expect(result).toEqual(responseTron);
      }
    });
  }

  validate(options: IScanOptions): void {
    const info = `Transaction validate in ${options.chainType} chain`;

    it(info, async () => {
      // Mock proxy services

      const responseEvm = <any>Utils.getUUID();

      jest.spyOn(this._serviceEVM, 'validate').mockImplementation(async () => {
        if (options.chainType === ChainType.EVM) {
          return responseEvm;
        }

        return null;
      });

      const responseTron = <any>Utils.getUUID();

      jest.spyOn(this._serviceTron, 'validate').mockImplementation(async () => {
        if (options.chainType === ChainType.TRON) {
          return responseTron;
        }

        return null;
      });

      // Testing

      const payload: ITransactionScanResult = {
        id: 100,
        hashIn: Utils.getUUID(),
        hashOut: Utils.getUUID(),
        blockNumber: 100,
        chainInId: 100,
        from: Utils.getUUID(),
        networkFee: '100',
        status: TransactionStatus.FINISHED,
        amount: '100',
        amountIn: '100',
        amountOut: '100',
        convertationFee: '100',
        to: Utils.getUUID(),
        currencyIn: Utils.getUUID(),
        currencyOut: Utils.getUUID(),
        chainOutId: 100,
      };

      const result = await this._service.validate(payload);

      if (options.chainType === ChainType.EVM) {
        expect(result).toEqual(responseEvm);
      } else if (options.chainType === ChainType.TRON) {
        expect(result).toEqual(responseTron);
      }
    });
  }
}

const test = new InspectorProxyServiceTest();
test.run();
