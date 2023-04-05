import BigNumber from 'bignumber.js';

import {
  NATIVE_CURRENCY_ADDRESS,
  TransactionStatus,
  ChainType,
} from '@libs/types';

import Utils from '@libs/utils/utils';
import AddressFormatter from '@libs/utils/address_formatter';

import TronProxyService from '@libs/tron/tron.proxy/tron.proxy.service';
import { TronRetValues } from '@libs/tron/tron.constants';

import ChainRepository from '@gateway/database/repositories/chain.repository';

import {
  IParseResult,
  ITransactionScanResult,
  IValidateResponse,
} from '@gateway/inspector/implementations/inspector.abstract';

import TestAbstract from '@gateway_test/test.abstract';
import ApplicationTestModule from '@gateway_test/main.test';

import TronGenerator from '@gateway_test/generators/tron.generator';

import InspectorTronNative from './inspector.tron.native';

interface IScanOptions {
  isWrongHash?: boolean;
  isTransactionNotFound?: boolean;
  isParseFailed?: boolean;

  isFinished?: boolean;
  isValidationRejected?: boolean;
  isContractRejected?: boolean;
}

interface IValidateOptions {
  isNotNativeTransfer?: boolean;
  isReceiptNotFound?: boolean;

  isFinished?: boolean;
  isRejected?: boolean;
}

interface IParseOptions {
  isNotNativeTransfer?: boolean;
}

class InspectorTronNativeTest extends TestAbstract {
  // Services

  private _tronProxy: TronProxyService;
  private _service: InspectorTronNative;

  // Repositories

  private _chainRepository: ChainRepository;

  // Generators

  private _tronGenerator: TronGenerator;

  run(): void {
    beforeAll(async () => {
      // Create application

      this._app = await ApplicationTestModule();

      // Repositories

      this._chainRepository = this._app.get<ChainRepository>(ChainRepository);

      // Services

      this._tronProxy = this._app.get<TronProxyService>(TronProxyService);
      this._service = new InspectorTronNative(
        this._tronProxy,
        this._chainRepository,
      );

      // Generators

      this._tronGenerator = new TronGenerator();
    });

    beforeEach(() => {
      jest.restoreAllMocks();
    });

    afterAll(async () => {
      await this._app.close();
    });

    describe('Inspector tron native transfer module', () => {
      describe('Scan', () => {
        this.scan({});
        this.scan({ isWrongHash: true });
        this.scan({ isTransactionNotFound: true });
        this.scan({ isParseFailed: true });
        this.scan({ isValidationRejected: true });
        this.scan({ isContractRejected: true });
        this.scan({ isFinished: true });
      });

      describe('Validate', () => {
        this.validate({});
        this.validate({ isReceiptNotFound: true });
        this.validate({ isReceiptNotFound: true, isRejected: true });
        this.validate({ isFinished: true });
        this.validate({ isNotNativeTransfer: true });
      });

      describe('Parse', () => {
        this.parse({});
        this.parse({ isNotNativeTransfer: true });
      });
    });
  }

  scan(options: IScanOptions): void {
    let info = `Transaction pending`;

    if (options.isTransactionNotFound) {
      info = `Transaction info not found`;
    } else if (options.isWrongHash) {
      info = `Hash is wrong`;
    } else if (options.isParseFailed) {
      info = `Parse is failed`;
    } else if (options.isFinished) {
      info = `Transaction is pending`;
    } else if (options.isValidationRejected) {
      info = `Transaction rejected by validation`;
    } else if (options.isContractRejected) {
      info = `Transaction rejected by contract`;
    }

    it(info, async () => {
      const chain = await this._chainRepository.findOne({
        where: {
          type: ChainType.TRON,
        },
      });

      // Mock tron

      const transaction = this._tronGenerator.transaction({
        contractRet: options.isContractRejected
          ? TronRetValues.FAILED
          : TronRetValues.SUCCESS,
      });

      const getTransactionMock = jest
        .spyOn(this._tronProxy, 'getTransaction')
        .mockImplementation(async (chainId: number, hash: string) => {
          if (hash === transaction.txID && chainId === chain.id) {
            return transaction;
          }

          return null;
        });

      // Mock parse

      const parseResult: IParseResult = {
        amount: '100',
        amountIn: '200',
        amountOut: '300',
        convertationFee: '10',
        to: Utils.getUUID(),
        currencyIn: Utils.getUUID(),
        currencyOut: Utils.getUUID(),
        contractAddress: Utils.getUUID(),
        chainOutId: 100,
      };

      const parseMock = jest
        .spyOn(this._service, 'parse')
        .mockImplementation(async () => {
          if (options.isParseFailed) {
            return null;
          }

          return parseResult;
        });

      // Mock validate

      const validateResponse: IValidateResponse = {
        status: TransactionStatus.PENDING,
        networkFee: '100',
        hashOut: Utils.getUUID(),
        blockNumber: 200,
        amountOut: '1000',
      };

      if (options.isFinished) {
        validateResponse.status = TransactionStatus.FINISHED;
      }

      if (options.isValidationRejected) {
        validateResponse.status = TransactionStatus.REJECTED;
      }

      const validateMock = jest
        .spyOn(this._service, 'validate')
        .mockImplementation(async () => {
          return validateResponse;
        });

      // Mock getCurrentBlock

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

      // Testing

      let hash = transaction.txID;

      if (options.isTransactionNotFound) {
        hash = Utils.randomBytes(32);
      }

      if (options.isWrongHash) {
        hash = Utils.randomBytes(16);
      }

      const requestId = 100;
      const result = await this._service.scan(requestId, hash, chain.id);

      if (options.isWrongHash) {
        expect(result).toBeNull();

        expect(getTransactionMock).not.toBeCalled();
        expect(parseMock).not.toBeCalled();
        expect(validateMock).not.toBeCalled();

        return;
      }

      expect(getTransactionMock).toBeCalled();
      expect(getTransactionMock).lastCalledWith(chain.id, hash);

      if (options.isTransactionNotFound) {
        expect(result).toBeNull();

        expect(parseMock).not.toBeCalled();
        expect(validateMock).not.toBeCalled();

        return;
      }

      expect(parseMock).toBeCalled();
      expect(parseMock).lastCalledWith({
        ...transaction,
        chainId: chain.id,
      });

      if (options.isParseFailed) {
        expect(result).toBeNull();
        expect(validateMock).not.toBeCalled();

        return;
      }

      const transactionData = transaction.raw_data.contract[0];
      const transactionParameters = transactionData.parameter.value;

      const resultExpected: ITransactionScanResult = {
        id: requestId,
        hashIn: hash,
        hashOut: hash,
        from: AddressFormatter.format(transactionParameters.owner_address),
        blockNumber: currentBlock.block_header.raw_data.number,
        chainInId: chain.id,
        status: TransactionStatus.PENDING,
        networkFee: '0',
        ...parseResult,
      };

      expect(validateMock).toBeCalled();
      expect(validateMock).lastCalledWith(resultExpected);

      resultExpected.networkFee = validateResponse.networkFee;
      resultExpected.amountOut = validateResponse.amountOut;
      resultExpected.hashOut = validateResponse.hashOut;
      resultExpected.networkFee = validateResponse.networkFee;
      resultExpected.blockNumber = validateResponse.blockNumber;

      if (options.isFinished) {
        resultExpected.status = TransactionStatus.FINISHED;
      }

      if (options.isValidationRejected || options.isContractRejected) {
        resultExpected.status = TransactionStatus.REJECTED;
      }

      expect(result).toEqual(resultExpected);
    });
  }

  validate(options: IValidateOptions): void {
    let info = `Transaction pending`;

    if (options.isReceiptNotFound) {
      info = `Transaction receipt not found`;

      if (options.isRejected) {
        info = `Transaction rejected`;
      }
    } else if (options.isFinished) {
      info = `Transaction is finished`;
    } else if (options.isNotNativeTransfer) {
      info = 'Transaction is not native transfer';
    }

    it(info, async () => {
      const chain = await this._chainRepository.findOne({
        where: {
          type: ChainType.TRON,
        },
      });

      // Mock tron

      let blockNumber =
        options.isReceiptNotFound && options.isRejected ? 200 : 100;

      if (options.isFinished) {
        blockNumber = 120;
      }

      const currentBlock = this._tronGenerator.block({
        blockNumber,
      });

      jest
        .spyOn(this._tronProxy, 'getCurrentBlock')
        .mockImplementation(async (chainId: number) => {
          if (chainId !== chain.id) {
            return null;
          }

          return currentBlock;
        });

      const transactionInfo = this._tronGenerator.info({
        blockNumber: 100,
      });

      jest
        .spyOn(this._tronProxy, 'getTransactionInfo')
        .mockImplementation(async (chainId: number, hash: string) => {
          if (hash === transactionInfo.id && chainId === chain.id) {
            return transactionInfo;
          }

          return null;
        });

      // Testing

      const payload: ITransactionScanResult = {
        id: 100,
        hashIn: options.isReceiptNotFound
          ? Utils.getUUID()
          : transactionInfo.id,
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
        chainOutId: chain.id,
        contractAddress: options.isNotNativeTransfer ? Utils.getUUID() : null,
      };

      const response = await this._service.validate(payload);

      if (options.isNotNativeTransfer) {
        expect(response).toBeNull();
        return;
      }

      const responseExpected: IValidateResponse = {
        status: TransactionStatus.REJECTED,
        networkFee: '0',
        blockNumber: 0,
        hashOut: payload.hashIn,
        amountOut: payload.amountOut,
      };

      if (options.isReceiptNotFound && options.isRejected) {
        expect(response).toEqual(responseExpected);
        return;
      }

      if (!options.isReceiptNotFound) {
        responseExpected.blockNumber = transactionInfo.blockNumber;

        const networkFee = new BigNumber(transactionInfo.fee)
          .shiftedBy(-chain.decimal)
          .toString();

        responseExpected.networkFee = networkFee;
      }

      responseExpected.status = options.isFinished
        ? TransactionStatus.FINISHED
        : TransactionStatus.PENDING;
      expect(response).toEqual(responseExpected);
    });
  }

  parse(options: IParseOptions): void {
    let info = `Simple request`;

    if (options.isNotNativeTransfer) {
      info = 'Transaction is not native transfer';
    }

    it(info, async () => {
      const chain = await this._chainRepository.findOne({
        where: {
          type: ChainType.TRON,
        },
      });

      const transaction = this._tronGenerator.transaction({
        data: options.isNotNativeTransfer ? '0x123' : null,
        amount: '100',
        to: 'TA2dkmLFWj2H3mavMtumfAHiv2Nj3MohuL',
      });

      const transactionData = transaction.raw_data.contract[0];
      const transactionParameters = transactionData.parameter.value;

      // Testing

      const response = await this._service.parse({
        ...transaction,
        chainId: chain.id,
      });

      if (options.isNotNativeTransfer) {
        expect(response).toBeNull();
        return;
      }

      const amountExpected = new BigNumber(transactionParameters.amount)
        .shiftedBy(-chain.decimal)
        .toString();

      const responseExpected: IParseResult = {
        chainOutId: chain.id,
        to: AddressFormatter.format(transactionParameters.to_address),
        amount: amountExpected,
        amountIn: amountExpected,
        amountOut: amountExpected,
        convertationFee: '0',
        currencyIn: NATIVE_CURRENCY_ADDRESS,
        currencyOut: NATIVE_CURRENCY_ADDRESS,
      };

      expect(response).toEqual(responseExpected);
    });
  }
}

const test = new InspectorTronNativeTest();
test.run();
