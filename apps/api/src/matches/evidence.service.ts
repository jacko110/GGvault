import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Identity } from '../auth/auth.guard';
import { fail, serializable } from '../common/domain';
import { PrismaService } from '../database/prisma.service';
import { MatchesService } from './matches.service';
import { EvidenceStorage } from './evidence.storage';
import { EvidencePolicy, EvidenceUpload } from './evidence.policy';
import { matchEvent } from './match-provision';

export const evidenceSelect = {
  id: true,
  matchId: true,
  uploadedByUserId: true,
  type: true,
  originalFilename: true,
  mimeType: true,
  size: true,
  sha256: true,
  createdAt: true,
};
@Injectable()
export class EvidenceService {
  constructor(
    private readonly db: PrismaService,
    private readonly matches: MatchesService,
    private readonly storage: EvidenceStorage,
    private readonly policy: EvidencePolicy,
  ) {}
  async upload(
    id: string,
    actor: Identity,
    type: 'SCREENSHOT' | 'VIDEO',
    file: EvidenceUpload | undefined,
  ) {
    const { mime, size } = this.policy.validate(file, type);
    await this.matches.access(this.db, id, actor, true);
    const objectKey = randomUUID();
    const sha256 = createHash('sha256')
      .update(new Uint8Array(file!.buffer))
      .digest('hex');
    await this.storage.put(objectKey, file!.buffer);
    try {
      return await serializable(this.db, async (tx) => {
        const match = await this.matches.mutation(tx, id, actor);
        if (
          !['IN_PROGRESS', 'RESULT_SUBMITTED'].includes(match.status) ||
          match.results[0]?.submittedByUserId === actor.sub
        )
          fail(
            409,
            'EVIDENCE_LOCKED',
            'Evidence uploads are closed for this player or match.',
          );
        const evidence = await tx.evidence.create({
          data: {
            entityType: 'Match',
            entityId: id,
            url: '',
            matchId: id,
            uploadedByUserId: actor.sub,
            type,
            objectKey,
            originalFilename: file!.originalname,
            mimeType: mime,
            size,
            sha256,
          },
          select: evidenceSelect,
        });
        await matchEvent(tx, id, 'EVIDENCE_UPLOADED', actor.sub);
        return evidence;
      });
    } catch (error) {
      // A lost connection may make commit outcome uncertain. Never delete an object referenced by metadata.
      try {
        if (!(await this.db.evidence.findUnique({ where: { objectKey } })))
          await this.storage.removeUncommitted(objectKey);
      } catch {
        /* Retain an unreferenced object for operator reconciliation if cleanup cannot be proven safe. */
      }
      throw error;
    }
  }
  list(id: string, actor: Identity) {
    return serializable(this.db, async (tx) => {
      await this.matches.access(tx, id, actor);
      return tx.evidence.findMany({
        where: { matchId: id },
        select: evidenceSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
    });
  }
  async content(id: string, evidenceId: string, actor: Identity) {
    const evidence = await serializable(this.db, async (tx) => {
      await this.matches.access(tx, id, actor);
      const row = await tx.evidence.findFirst({
        where: { id: evidenceId, matchId: id },
      });
      if (!row?.objectKey || !row.mimeType)
        fail(404, 'EVIDENCE_NOT_FOUND', 'Evidence not found.');
      return row;
    });
    const data = await this.storage.read(evidence.objectKey!);
    if (
      data.length !== evidence.size ||
      createHash('sha256').update(new Uint8Array(data)).digest('hex') !==
        evidence.sha256
    )
      fail(
        500,
        'EVIDENCE_INTEGRITY_ERROR',
        'Stored evidence failed integrity verification.',
      );
    return { data, mime: evidence.mimeType! };
  }
}
