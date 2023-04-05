import { Connection } from 'typeorm';

import { expect } from '@jest/globals';
import '@jest-custom/entity-compare.matcher';

import { TransactionStatus, ChainType } from '@libs/types';

import Utils from '@libs/utils/utils';

import ChainRepository from '@gateway/database/repositories/chain.repository';

import Transaction, {
  IInspectorMeta,
} from '@gateway/database/entities/transaction.entity';
import { ContractType } from '@gateway/database/entities/contract.entity';

import { ITransactionScanResult } from '@gateway/inspector/implementations/inspector.abstract';

import ContractGenerator from '@gateway_test/generators/contract.generator';
import TransactionGenerator from '@gateway_test/generators/transaction.generator';

import TestAbstract from '@gateway_test/test.abstract';
import ApplicationTestModule from '@gateway_test/main.test';

import InspectorRecorderService from './inspector.recorder.service';

interface IRecordOptions {
  isWithoutContract?: boolean;
  isTransactionAlreadyExists?: boolean;
}

class InspectorRecorderServiceTest extends TestAbstract {
  private _database: Connection;

  // Services

  private _service: InspectorRecorderService;

  // Repositories

  private _chainRepository: ChainRepository;

  // Generators

  private _contractGenerator: ContractGenerator;
  private _transactionGenerator: TransactionGenerator;

  run(): void {
    beforeAll(async () => {
      // Create application

      this._app = await ApplicationTestModule();
      this._database = this._app.get<Connection>(Connection);

      // Repositories

      this._chainRepository = this._app.get<ChainRepository>(ChainRepository);

      // Services

      this._service = this._app.get<InspectorRecorderService>(
        InspectorRecorderService,
      );

      // Generators

      this._contractGenerator = new ContractGenerator(this._database);
      this._transactionGenerator = new TransactionGenerator(this._database);
    });

    afterAll(async () => {
      await this._app.close();
    });

    describe('Inspector recorder module', () => {
      this.record({});
      this.record({ isWithoutContract: true });
      this.record({ isTransactionAlreadyExists: true });
    });
  }

  record(options: IRecordOptions): void {
    let info = `Insert transaction record`;

    if (options.isWithoutContract) {
      info = `Insert transaction record without contract id`;
    } else if (options.isTransactionAlreadyExists) {
      info = `Update transaction record`;
    }

    it(info, async () => {
      const chain = await this._chainRepository.findOne({
        where: {
          type: ChainType.EVM,
        },
      });

      await this._contractGenerator.repository.delete({});

      const token = await this._contractGenerator.contract({
        chainId: chain.id,
        type: ContractType.TOKEN,
        address: Utils.getUUID(),
      });

      const transaction = await this._transactionGenerator.transaction({
        chain_id: chain.id,
      });

      // Testing

      const payload: ITransactionScanResult = {
        id: 100,
        hashIn: options.isTransactionAlreadyExists
          ? transaction.hash
          : Utils.getUUID(),
        hashOut: Utils.getUUID(),
        blockNumber: 100,
        chainInId: chain.id,
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
        contractAddress: options.isWithoutContract ? null : token.address,
        chainOutId: chain.id,
      };

      await this._service.record(payload);

      // Checkout database row

      const metaExpected: IInspectorMeta = {
        amountIn: payload.amountIn,
        amountOut: payload.amountOut,
        convertationFee: payload.convertationFee,
        currencyIn: payload.currencyIn,
        currencyOut: payload.currencyOut,
        hashOut: payload.hashOut,
        chainOutId: payload.chainOutId,
      };

      const transactionUpdated =
        await this._transactionGenerator.repository.findOne({
          where: {
            hash: payload.hashIn,
          },
        });

      expect(transactionUpdated).toBeDefined();

      const transactionExpected = new Transaction();

      transactionExpected.id = options.isTransactionAlreadyExists
        ? transaction.id
        : transactionUpdated.id;
      transactionExpected.hash = payload.hashIn;
      transactionExpected.block_number = payload.blockNumber;
      transactionExpected.chain_id = chain.id;
      transactionExpected.from = payload.from;
      transactionExpected.to = payload.to;
      transactionExpected.meta = metaExpected;
      transactionExpected.amount = payload.amount;
      transactionExpected.fee = payload.networkFee;
      transactionExpected.status = TransactionStatus.FINISHED;
      transactionExpected.contract_id = options.isWithoutContract
        ? null
        : token.id;

      expect(transactionUpdated).toEntityCompare(transactionExpected);
    });
  }
}

const test = new InspectorRecorderServiceTest();
test.run();
