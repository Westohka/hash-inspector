import BigNumber from 'bignumber.js';

import {
  NATIVE_CURRENCY_ADDRESS,
  TransactionStatus,
  ChainType,
} from '@libs/types';

import Utils from '@libs/utils/utils';

import Web3ProxyService from '@libs/web3/web3.proxy/web3.proxy.service';

import ChainRepository from '@gateway/database/repositories/chain.repository';

import {
  IParseResult,
  ITransactionScanResult,
  IValidateResponse,
} from '@gateway/inspector/implementations/inspector.abstract';

import Web3Generator from '@gateway_test/generators/web3.generator';

import TestAbstract from '@gateway_test/test.abstract';
import ApplicationTestModule from '@gateway_test/main.test';

import InspectorEvmNative from './inspector.evm.native';

interface IScanOptions {
  isWrongHash?: boolean;
  isTransactionNotFound?: boolean;
  isParseFailed?: boolean;

  isFinished?: boolean;
  isRejected?: boolean;
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

class InspectorEvmNativeTest extends TestAbstract {
  // Services

  private _web3Proxy: Web3ProxyService;
  private _service: InspectorEvmNative;

  // Repositories

  private _chainRepository: ChainRepository;

  // Generators

  private _web3Generator: Web3Generator;

  run(): void {
    beforeAll(async () => {
      // Create application

      this._app = await ApplicationTestModule();

      // Repositories

      this._chainRepository = this._app.get<ChainRepository>(ChainRepository);

      // Services

      this._web3Proxy = this._app.get<Web3ProxyService>(Web3ProxyService);
      this._service = new InspectorEvmNative(
        this._web3Proxy,
        this._chainRepository,
      );

      // Generators

      this._web3Generator = new Web3Generator();
    });

    beforeEach(() => {
      jest.restoreAllMocks();
    });

    afterAll(async () => {
      await this._app.close();
    });

    describe('Inspector evm native module', () => {
      describe('Scan', () => {
        this.scan({});
        this.scan({ isWrongHash: true });
        this.scan({ isTransactionNotFound: true });
        this.scan({ isParseFailed: true });
        this.scan({ isRejected: true });
        this.scan({ isFinished: true });
      });

      describe('Validate', () => {
        this.validate({});
        this.validate({ isNotNativeTransfer: true });
        this.validate({ isReceiptNotFound: true });
        this.validate({ isRejected: true });
        this.validate({ isFinished: true });
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
    } else if (options.isRejected) {
      info = `Transaction rejected`;
    }

    it(info, async () => {
      const chain = await this._chainRepository.findOne({
        where: {
          type: ChainType.EVM,
        },
      });

      // Mock web3

      const transactionInfo = this._web3Generator.transaction({});

      const getTransactionMock = jest
        .spyOn(this._web3Proxy, 'getTransaction')
        .mockImplementation(async (chainId: number, hash: string) => {
          if (hash === transactionInfo.hash && chainId === chain.id) {
            return transactionInfo;
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
        blockNumber: 200,
        hashOut: Utils.getUUID(),
        amountOut: '1000',
      };

      if (options.isFinished) {
        validateResponse.status = TransactionStatus.FINISHED;
      }

      if (options.isRejected) {
        validateResponse.status = TransactionStatus.REJECTED;
      }

      const validateMock = jest
        .spyOn(this._service, 'validate')
        .mockImplementation(async () => {
          return validateResponse;
        });

      // Testing

      let hash = transactionInfo.hash;

      if (options.isWrongHash) {
        hash = Utils.getUUID();
      }

      if (options.isTransactionNotFound) {
        hash = '0x' + Utils.randomBytes(32);
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
        ...transactionInfo,
        chainId: chain.id,
      });

      if (options.isParseFailed) {
        expect(result).toBeNull();
        expect(validateMock).not.toBeCalled();

        return;
      }

      const resultExpected: ITransactionScanResult = {
        id: requestId,
        hashIn: hash,
        hashOut: hash,
        from: transactionInfo.from.toLowerCase(),
        blockNumber: transactionInfo.blockNumber,
        chainInId: chain.id,
        status: TransactionStatus.PENDING,
        ...parseResult,
        networkFee: '0',
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

      if (options.isRejected) {
        resultExpected.status = TransactionStatus.REJECTED;
      }

      expect(result).toEqual(resultExpected);
    });
  }

  validate(options: IValidateOptions): void {
    let info = `Transaction pending`;

    if (options.isReceiptNotFound) {
      info = `Transaction receipt not found`;
    } else if (options.isFinished) {
      info = `Transaction is finished`;
    } else if (options.isRejected) {
      info = `Transaction rejected`;
    } else if (options.isNotNativeTransfer) {
      info = 'Transaction is not native transfer';
    }

    it(info, async () => {
      const chain = await this._chainRepository.findOne({
        where: {
          type: ChainType.EVM,
        },
      });

      // Mock web3

      const blockNumber = 100;

      const getBlockHeightMock = jest
        .spyOn(this._web3Proxy, 'getBlockHeight')
        .mockImplementation(async (chainId: number) => {
          if (chainId !== chain.id) {
            return null;
          }

          return options.isFinished ? blockNumber + 100 : blockNumber;
        });

      const receipt = this._web3Generator.receipt({
        status: !options.isRejected,
        blockNumber,
      });

      const getTransactionReceiptMock = jest
        .spyOn(this._web3Proxy, 'getTransactionReceipt')
        .mockImplementation(async (chainId: number, hash: string) => {
          if (hash === receipt.transactionHash && chainId === chain.id) {
            return receipt;
          }

          return null;
        });

      // Testing

      const payload: ITransactionScanResult = {
        id: 100,
        hashIn: options.isReceiptNotFound
          ? Utils.getUUID()
          : receipt.transactionHash,
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
        hashOut: payload.hashIn,
        blockNumber: payload.blockNumber,
        amountOut: payload.amountOut,
      };

      expect(getTransactionReceiptMock).toBeCalled();
      expect(getTransactionReceiptMock).lastCalledWith(
        chain.id,
        payload.hashIn,
      );

      if (options.isReceiptNotFound) {
        expect(response).toEqual(responseExpected);
        expect(getBlockHeightMock).not.toBeCalled();

        return;
      }

      const networkFeeBN = new BigNumber(receipt.gasUsed)
        .multipliedBy(receipt.effectiveGasPrice)
        .toFixed(0, BigNumber.ROUND_DOWN);

      const networkFee = new BigNumber(networkFeeBN)
        .shiftedBy(-chain.decimal)
        .toString();

      responseExpected.networkFee = networkFee;

      if (options.isRejected) {
        expect(response).toEqual(responseExpected);
        expect(getBlockHeightMock).not.toBeCalled();

        return;
      }

      expect(getBlockHeightMock).toBeCalled();

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
          type: ChainType.EVM,
        },
      });

      const transactionInfo = this._web3Generator.transaction({
        input: options.isNotNativeTransfer ? '0x123' : '0x',
      });

      // Testing

      const response = await this._service.parse({
        ...transactionInfo,
        chainId: chain.id,
      });

      if (options.isNotNativeTransfer) {
        expect(response).toBeNull();
        return;
      }

      const amountExpected = new BigNumber(transactionInfo.value)
        .shiftedBy(-chain.decimal)
        .toString();

      const responseExpected: IParseResult = {
        chainOutId: chain.id,
        to: transactionInfo.to.toLowerCase(),
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

const test = new InspectorEvmNativeTest();
test.run();
