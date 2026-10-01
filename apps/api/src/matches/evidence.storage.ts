import { Injectable } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { resolve, join } from 'path';

export abstract class EvidenceStorage {
  abstract put(key: string, data: Buffer): Promise<void>;
  abstract read(key: string): Promise<Buffer>;
  abstract removeUncommitted(key: string): Promise<void>;
}

@Injectable()
export class LocalEvidenceStorage extends EvidenceStorage {
  private readonly root = resolve(
    process.env.EVIDENCE_STORAGE_DIR ?? 'storage/evidence',
  );
  private path(key: string) {
    if (!/^[a-f0-9-]{36}$/.test(key))
      throw new Error('Invalid evidence object key');
    return join(this.root, key);
  }
  async put(key: string, data: Buffer) {
    await mkdir(this.root, { recursive: true });
    await writeFile(this.path(key), new Uint8Array(data), {
      flag: 'wx',
      mode: 0o600,
    });
  }
  async read(key: string) {
    return Buffer.from(new Uint8Array(await readFile(this.path(key))));
  }
  async removeUncommitted(key: string) {
    await unlink(this.path(key));
  }
}
