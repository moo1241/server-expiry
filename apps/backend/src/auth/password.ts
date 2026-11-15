import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const keyLength = 64;
const cost = 16_384;
const blockSize = 8;
const parallelization = 1;
const maxMemory = 32 * 1024 * 1024;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, keyLength, {
    N: cost,
    r: blockSize,
    p: parallelization,
    maxmem: maxMemory,
  });

  return [
    'scrypt',
    cost,
    blockSize,
    parallelization,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

export function verifyPassword(password: string, encodedHash: string): boolean {
  const parts = encodedHash.split('$');

  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const parsedCost = Number.parseInt(parts[1], 10);
  const parsedBlockSize = Number.parseInt(parts[2], 10);
  const parsedParallelization = Number.parseInt(parts[3], 10);

  if (
    !Number.isSafeInteger(parsedCost) ||
    !Number.isSafeInteger(parsedBlockSize) ||
    !Number.isSafeInteger(parsedParallelization) ||
    parsedCost < 1 ||
    parsedBlockSize < 1 ||
    parsedParallelization < 1
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(parts[4], 'base64url');
    const expectedKey = Buffer.from(parts[5], 'base64url');

    if (salt.length < 16 || expectedKey.length !== keyLength) {
      return false;
    }

    const actualKey = scryptSync(password, salt, expectedKey.length, {
      N: parsedCost,
      r: parsedBlockSize,
      p: parsedParallelization,
      maxmem: maxMemory,
    });

    return actualKey.length === expectedKey.length && timingSafeEqual(actualKey, expectedKey);
  } catch {
    return false;
  }
}
