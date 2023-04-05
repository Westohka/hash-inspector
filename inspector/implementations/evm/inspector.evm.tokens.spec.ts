import { Connection } from 'typeorm';
import BigNumber from 'bignumber.js';

import { TransactionStatus, ChainType } from '@libs/types';

import Utils from '@libs/utils/utils';

import Web3ProxyService from '@libs/web3/web3.proxy/web3.proxy.service';

import ChainRepository from '@gateway/database/repositories/chain.repository';
import ContractRepository from '@gateway/database/repositories/contract.repository';

import { ContractType } from '@gateway/database/entities/contract.entity';

import {
  IParseResult,
  ITransactionScanResult,
} from '@gateway/inspector/implementations/inspector.abstract';

import Web3Generator from '@gateway_test/generators/web3.generator';
import ContractGenerator from '@gateway_test/generators/contract.generator';

import TestAbstract from '@gateway_test/test.abstract';
import ApplicationTestModule from '@gateway_test/main.test';

import InspectorEvmTokens from './inspector.evm.tokens';

interface IParseOptions {
  isNotTokenTransfer?: boolean;
  isTokenNotFound?: boolean;
}

interface IValidateOptions {
  isNotTokenTransfer?: boolean;
}

class InspectorEvmTokensTest extends TestAbstract {
  private _database: Connection;

  // Services

  private _web3Proxy: Web3ProxyService;
  private _service: InspectorEvmTokens;

  // Repositories

  private _chainRepository: ChainRepository;

  // Generators

  private _web3Generator: Web3Generator;
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

      this._web3Proxy = this._app.get<Web3ProxyService>(Web3ProxyService);
      this._service = new InspectorEvmTokens(
        this._web3Proxy,
        this._chainRepository,
        contractRepository,
      );

      // Generators

      this._web3Generator = new Web3Generator();
      this._contractGenerator = new ContractGenerator(this._database);
    });

    beforeEach(() => {
      jest.restoreAllMocks();
    });

    afterAll(async () => {
      await this._app.close();
    });

    describe('Inspector evm token transfer module', () => {
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
          type: ChainType.EVM,
        },
      });

      await this._contractGenerator.repository.delete({});

      const token = await this._contractGenerator.contract({
        chainId: chain.id,
        type: ContractType.TOKEN,
        address: '0x9a01bf917477dD9F5D715D188618fc8B7350cd22',
      });

      const transactionInfo = this._web3Generator.transaction({
        input: options.isNotTokenTransfer
          ? '0x123'
          : '0xa9059cbb000000000000000000000000228c3c67491d0e78f5b0a40caf83339806f25e4f0000000000000000000000000000000000000000000000000de0b6b3a7640000',
        to: options.isTokenNotFound ? Utils.getUUID() : token.address,
      });

      // Testing

      const response = await this._service.parse({
        ...transactionInfo,
        chainId: chain.id,
      });

      if (options.isNotTokenTransfer || options.isTokenNotFound) {
        expect(response).toBeNull();
        return;
      }

      const amountExpected = new BigNumber('1000000000000000000')
        .shiftedBy(-token.decimal)
        .toString();

      const responseExpected: IParseResult = {
        chainOutId: chain.id,
        to: '0x228c3c67491d0e78f5b0a40caf83339806f25e4f'.toLowerCase(),
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
    let info = `Super class implementation`;

    if (options.isNotTokenTransfer) {
      info = 'Transaction is not token transfer';
    }

    it(info, async () => {
      const chain = await this._chainRepository.findOne({
        where: {
          type: ChainType.EVM,
        },
      });

      const token = await this._contractGenerator.contract({
        type: ContractType.TOKEN,
        chainId: chain.id,
      });

      // Mock web3

      jest
        .spyOn(this._web3Proxy, 'getTransactionReceipt')
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

const test = new InspectorEvmTokensTest();
test.run();
