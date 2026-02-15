import * as kdbxweb from 'kdbxweb';
import { argon2d, argon2id } from 'hash-wasm';

/**
 * Configure kdbxweb's CryptoEngine with Argon2 implementation via hash-wasm.
 * hash-wasm loads WASM lazily (only when hash function is first called),
 * so it works well in Chrome MV3 Service Workers.
 * Must be called once before any kdbx operations.
 */
export function initCryptoEngine(): void {
  kdbxweb.CryptoEngine.setArgon2Impl(
    async (
      password: ArrayBuffer,
      salt: ArrayBuffer,
      memory: number,
      iterations: number,
      length: number,
      parallelism: number,
      type: number,
      version: number,
    ): Promise<ArrayBuffer> => {
      // type 0 = Argon2d, type 2 = Argon2id
      const hashFn = type === 0 ? argon2d : argon2id;

      const result = await hashFn({
        password: new Uint8Array(password),
        salt: new Uint8Array(salt),
        memorySize: memory,
        iterations,
        hashLength: length,
        parallelism,
        outputType: 'binary',
      });

      return result.buffer;
    },
  );
}
