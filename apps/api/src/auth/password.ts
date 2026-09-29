import { argon2id, hash, verify } from 'argon2';

export function hashPassword(password: string): Promise<string> {
  return hash(password, {
    type: argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  if (!passwordHash) return false; // Legacy accounts have no usable password.
  return verify(passwordHash, password);
}
