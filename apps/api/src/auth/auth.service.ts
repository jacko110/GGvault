import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { audit, fail, serializable } from '../common/domain';
import { LoginDto, RegisterDto } from './auth.dto';
import { hashPassword, verifyPassword } from './password';

export const publicUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  status: true,
  emailVerified: true,
  createdAt: true,
  profile: { select: { bio: true, avatarUrl: true, countryCode: true } },
} satisfies Prisma.UserSelect;
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
    private readonly ledger: LedgerService,
  ) {}

  private async issue(
    tx: Prisma.TransactionClient,
    user: { id: string; role: UserRole },
    expiresAt = new Date(Date.now() + 30 * 86400000),
  ) {
    const refreshToken = randomBytes(48).toString('hex');
    const session = await tx.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: tokenHash(refreshToken),
        expiresAt,
      },
    });
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      sessionId: session.id,
    });
    return { accessToken, refreshToken, expiresIn: 900, tokenType: 'Bearer' };
  }

  async register(dto: RegisterDto) {
    const passwordHash = await hashPassword(dto.password);
    return serializable(this.db, async (tx) => {
      if (await tx.user.findUnique({ where: { email: dto.email } }))
        fail(409, 'USER_EMAIL_EXISTS', 'Email already registered.');
      if (await tx.user.findUnique({ where: { username: dto.username } }))
        fail(409, 'USER_USERNAME_EXISTS', 'Username already registered.');
      const user = await tx.user.create({
        data: { email: dto.email, username: dto.username, passwordHash },
        select: publicUserSelect,
      });
      if (process.env.ENABLE_TEST_CREDITS === 'true') {
        const amount = Number(process.env.INITIAL_TEST_CREDITS ?? 100);
        if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647)
          throw new Error('Invalid initial credit configuration');
        await this.ledger.createInitialCredit(
          {
            userId: user.id,
            amount,
            idempotencyKey: `registration:${user.id}`,
          },
          tx,
        );
      }
      await audit(tx, user.id, 'USER_REGISTERED', 'User', user.id);
      return { user, ...(await this.issue(tx, user)) };
    });
  }

  async login(dto: LoginDto) {
    const user = await this.db.user.findUnique({ where: { email: dto.email } });
    // Perform Argon2 work even for an unknown email to reduce account enumeration by timing.
    const valid = user?.passwordHash
      ? await verifyPassword(user.passwordHash, dto.password)
      : (await hashPassword(dto.password), false);
    if (!user || !valid || user.status !== 'ACTIVE') {
      await audit(this.db, user?.id ?? null, 'LOGIN_FAILED', 'Session');
      fail(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials.');
    }
    return serializable(this.db, async (tx) => {
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (
        current.status !== 'ACTIVE' ||
        current.passwordHash !== user.passwordHash
      )
        fail(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid credentials.');
      await audit(tx, user.id, 'LOGIN_SUCCEEDED', 'User', user.id);
      return this.issue(tx, current);
    });
  }

  refresh(refreshToken: string) {
    return serializable(this.db, async (tx) => {
      const session = await tx.session.findUnique({
        where: { refreshTokenHash: tokenHash(refreshToken) },
        include: { user: true },
      });
      if (!session)
        fail(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid refresh token.');
      if (session.revokedAt)
        fail(401, 'AUTH_SESSION_REVOKED', 'Session revoked.');
      if (session.expiresAt <= new Date())
        fail(401, 'AUTH_SESSION_EXPIRED', 'Session expired.');
      if (session.user.status !== 'ACTIVE')
        fail(403, 'USER_INACTIVE', 'Account is not active.');
      await tx.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), lastUsedAt: new Date() },
      });
      await audit(
        tx,
        session.userId,
        'SESSION_REFRESHED',
        'Session',
        session.id,
      );
      return this.issue(tx, session.user, session.expiresAt);
    });
  }

  logout(userId: string, sessionId: string) {
    return serializable(this.db, async (tx) => {
      await tx.session.updateMany({
        where: { id: sessionId, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await audit(tx, userId, 'LOGOUT', 'Session', sessionId);
      return { success: true };
    });
  }

  me(userId: string) {
    return this.db.user.findUniqueOrThrow({
      where: { id: userId },
      select: publicUserSelect,
    });
  }
}
