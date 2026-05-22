import { SessionModel } from '../db/sessions.js';
import type { SessionsRepo } from '../db/sessions.js';

export async function sweepStaleSessions(
  _repo: SessionsRepo,
  maxAgeMs: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMs);
  const res = await SessionModel.updateMany(
    { status: 'active', startedAt: { $lt: cutoff } },
    { $set: { status: 'ended', endReason: 'stale', endedAt: new Date() } },
  );
  return res.modifiedCount;
}
