import Utils from '@libs/utils/utils';

import { TransactionStatus } from '@libs/types';

import BrokerClientMock from '@libs/broker_test/BrokerClientMock';
import { GatewayTypes } from '@libs/broker/types';

import TestAbstract from '@gateway_test/test.abstract';
import ApplicationTestModule from '@gateway_test/main.test';

import { ITransactionScanResult } from '../implementations/inspector.abstract';

import InspectorNotifierService, {
  NotifyData,
} from './inspector.notifier.service';

jest.mock('@libs/broker/broker.client');

interface INotifyOptions {
  isFinished?: boolean;
  isRejected?: boolean;
  isWithoutData?: boolean;
}

class InspectorNotifierServiceTest extends TestAbstract {
  // Services

  private _service: InspectorNotifierService;

  // Mocks

  private _brokerSendMock: jest.SpyInstance;

  run(): void {
    beforeAll(async () => {
      // Mock broker client

      const _BrokerClientMock = BrokerClientMock();
      this._brokerSendMock = _BrokerClientMock.send;

      // Create application

      this._app = await ApplicationTestModule();

      // Services

      this._service = this._app.get<InspectorNotifierService>(
        InspectorNotifierService,
      );
    });

    afterAll(async () => {
      await this._app.close();
    });

    beforeEach(async () => {
      // Clear mocks

      this._brokerSendMock.mockClear();
    });

    describe('Inspector notify module', () => {
      this.notify({});
      this.notify({ isFinished: true });
      this.notify({ isRejected: true });
      this.notify({ isWithoutData: true });
    });
  }

  notify(options: INotifyOptions): void {
    let info = `Transaction is pending`;

    if (options.isFinished) {
      info = `Transaction is finished`;
    } else if (options.isRejected) {
      info = `Transaction is rejected`;
    } else if (options.isWithoutData) {
      info = 'Transaction is rejected without parse data';
    }

    it(info, async () => {
      // Testing

      const notifyData: NotifyData = !options.isWithoutData
        ? {
            id: 100,
            hashIn: Utils.getUUID(),
            hashOut: Utils.getUUID(),
            status: TransactionStatus.PENDING,
            blockNumber: 100,
            chainInId: 1,
            from: Utils.getUUID(),
            networkFee: '100',
            amount: '100',
            amountIn: '100',
            amountOut: '100',
            convertationFee: '100',
            to: Utils.getUUID(),
            currencyIn: Utils.getUUID(),
            currencyOut: Utils.getUUID(),
            contractAddress: Utils.getUUID(),
            chainOutId: 2,
          }
        : {
            id: 100,
            hashIn: Utils.getUUID(),
            hashOut: Utils.getUUID(),
            status: TransactionStatus.REJECTED,
          };

      if (options.isFinished) {
        notifyData.status = TransactionStatus.FINISHED;
      }

      if (options.isRejected) {
        notifyData.status = TransactionStatus.REJECTED;
      }

      await this._service.notify(notifyData);

      // Checkout broker message

      expect(this._brokerSendMock).toBeCalledTimes(1);

      const queue = this._brokerSendMock.mock.calls[0][0];
      expect(queue).toEqual(GatewayTypes.Scan.TRANSACTION_SCAN_RESULT);

      const message: GatewayTypes.Scan.ITransactionScanResult =
        this._brokerSendMock.mock.calls[0][1];

      if (options.isWithoutData) {
        const messageExpected: GatewayTypes.Scan.ITransactionScanResult = {
          id: notifyData.id,
          hashIn: notifyData.hashIn,
          hashOut: notifyData.hashOut,
          status: TransactionStatus.REJECTED,
        };

        expect(message).toEqual(messageExpected);
      } else {
        const parseInfo = <ITransactionScanResult>notifyData;

        const messageExpected: GatewayTypes.Scan.ITransactionScanResult = {
          id: notifyData.id,
          hashIn: notifyData.hashIn,
          hashOut: notifyData.hashOut,
          chainInId: parseInfo.chainInId,
          chainOutId: parseInfo.chainOutId,
          status: TransactionStatus.PENDING,
          from: parseInfo.from,
          to: parseInfo.to,
          blockNumber: parseInfo.blockNumber,
          networkFee: parseInfo.networkFee,
          amount: parseInfo.amount,
          amountIn: parseInfo.amountIn,
          amountOut: parseInfo.amountOut,
          convertationFee: parseInfo.convertationFee,
          currencyIn: parseInfo.currencyIn,
          currencyOut: parseInfo.currencyOut,
          contractAddress: parseInfo.contractAddress,
        };

        if (options.isFinished) {
          messageExpected.status = TransactionStatus.FINISHED;
        }

        if (options.isRejected) {
          messageExpected.status = TransactionStatus.REJECTED;
        }

        expect(message).toEqual(messageExpected);
      }
    });
  }
}

const test = new InspectorNotifierServiceTest();
test.run();
