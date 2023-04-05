import BigNumber from 'bignumber.js';

import { Connection } from 'typeorm';

import { TransactionStatus, ChainType } from '@libs/types';

import Utils from '@libs/utils/utils';

import TronProxyService from '@libs/tron/tron.proxy/tron.proxy.service';

import ChainRepository from '@gateway/database/repositories/chain.repository';
import ContractRepository from '@gateway/database/repositories/contract.repository';

import { ContractType } from '@gateway/database/entities/contract.entity';

import {
  IParseResult,
  ITransactionScanResult,
} from '@gateway/inspector/implementations/inspector.abstract';

import TestAbstract from '@gateway_test/test.abstract';
import ApplicationTestModule from '@gateway_test/main.test';

import TronGenerator from '@gateway_test/generators/tron.generator';
import ContractGenerator from '@gateway_test/generators/contract.generator';

import InspectorTronTokens from './inspector.tron.tokens';

interface IParseOptions {
  isNotTokenTransfer?: boolean;
  isTokenNotFound?: boolean;
}

interface IValidateOptions {
  isNotTokenTransfer?: boolean;
}

class InspectorTronTokensTest extends TestAbstract {
  private _database: Connection;

  // Services

  private _tronProxy: TronProxyService;
  private _service: InspectorTronTokens;

  // Repositories

  private _chainRepository: ChainRepository;

  // Generators

  private _tronGenerator: TronGenerator;
  private _contractGenerator: ContractGenerator;

  run(): void {
    beforeAll(async () => {
      // Create application

      this._app = await ApplicationTestModule();
      this._database = this._app.get<Connection>(Connection);

      // Repositories

      this._chainRepository = this._app.get<ChainRepository>(ChainRepository);
      const contractRepository =
        this._app.get<ContractRepository>(ContractRepository);

      // Services

      this._tronProxy = this._app.get<TronProxyService>(TronProxyService);
      this._service = new InspectorTronTokens(
        this._tronProxy,
        this._chainRepository,
        contractRepository,
      );

      // Generators

      this._tronGenerator = new TronGenerator();
      this._contractGenerator = new ContractGenerator(this._database);
    });

    beforeEach(() => {
      jest.restoreAllMocks();
    });

    afterAll(async () => {
      await this._app.close();
    });

    describe('Inspector tron tokens transfer module', () => {
      describe('Validate', () => {
        this.validate({});
        this.validate({ isNotTokenTransfer: true });
      });

      describe('Parse', () => {
        this.parse({});
        this.parse({ isNotTokenTransfer: true });
        this.parse({ isTokenNotFound: true });
      });
    });
  }

  parse(options: IParseOptions): void {
    let info = `Simple request`;

    if (options.isNotTokenTransfer) {
      info = 'Transaction is not token transfer';
    } else if (options.isTokenNotFound) {
      info = 'Token not found';
    }

    it(info, async () => {
      const chain = await this._chainRepository.findOne({
        where: {
          type: ChainType.TRON,
        },
      });

      await this._contractGenerator.repository.delete({});

      const token = await this._contractGenerator.contract({
        chainId: chain.id,
        type: ContractType.TOKEN,
        address: 'TCAcfX4ieUe3w9WtMphHYb2vTCEah4pYUJ',
      });

      const transaction = this._tronGenerator.transaction({
        contractAddress: options.isTokenNotFound ? '123' : token.address,
        data: options.isNotTokenTransfer
          ? '123'
          : 'a9059cbb00000000000000000000000000a5e93ea3df9857443f4b9c777b0058187e204900000000000000000000000000000000000000000000000000038d7ea4c68000',
      });

      // Testing

      const response = await this._service.parse({
        ...transaction,
        chainId: chain.id,
      });

      if (options.isNotTokenTransfer || options.isTokenNotFound) {
        expect(response).toBeNull();
        return;
      }

      const amountExpected = new BigNumber('1000000000000000')
        .shiftedBy(-token.decimal)
        .toString();

      const responseExpected: IParseResult = {
        chainOutId: chain.id,
        to: 'TA2dkmLFWj2H3mavMtumfAHiv2Nj3MohuL',
        amount: amountExpected,
        amountIn: amountExpected,
        amountOut: amountExpected,
        convertationFee: '0',
        currencyIn: token.address,
        currencyOut: token.address,
        contractAddress: token.address,
      };

      expect(response).toEqual(responseExpected);
    });
  }

  validate(options: IValidateOptions): void {
    let info = `Supper class implementation`;

    if (options.isNotTokenTransfer) {
      info = 'Transaction is not token transfer';
    }

    it(info, async () => {
      const chain = await this._chainRepository.findOne({
        where: {
          type: ChainType.TRON,
        },
      });

      const token = await this._contractGenerator.contract({
        type: ContractType.TOKEN,
        chainId: chain.id,
      });

      // Mock tron

      const currentBlock = this._tronGenerator.block({
        blockNumber: 100,
      });

      jest
        .spyOn(this._tronProxy, 'getCurrentBlock')
        .mockImplementation(async (chainId: number) => {
          if (chainId !== chain.id) {
            return null;
          }

          return currentBlock;
        });

      jest
        .spyOn(this._tronProxy, 'getTransactionInfo')
        .mockImplementation(async () => {
          return null;
        });

      // Testing

      const payload: ITransactionScanResult = {
        id: 100,
        hashIn: Utils.getUUID(),
        hashOut: Utils.getUUID(),
        blockNumber: 100,
        chainInId: chain.id,
        from: Utils.getUUID(),
        networkFee: '100',
        status: TransactionStatus.PENDING,
        amount: '100',
        amountIn: '100',
        amountOut: '100',
        convertationFee: '100',
        to: Utils.getUUID(),
        currencyIn: Utils.getUUID(),
        currencyOut: Utils.getUUID(),
        chainOutId: chain.id,
        contractAddress: options.isNotTokenTransfer
          ? Utils.getUUID()
          : token.address,
      };

      const response = await this._service.validate(payload);

      if (options.isNotTokenTransfer) {
        expect(response).toBeNull();
      } else {
        expect(response).not.toBeNull();
      }
    });
  }
}

const test = new InspectorTronTokensTest();
test.run();
