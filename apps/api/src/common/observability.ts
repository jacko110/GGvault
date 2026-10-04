import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

type Observation = { count: number; sum: number; buckets: number[] };
const bounds = [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const observations = new Map<string, Observation>();
// Only these fields can leave the logger. Never serialize request/error objects.
export function structuredLog(fields: {
  level: string;
  event: string;
  requestId?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  actorUserId?: string;
  challengeId?: string;
  matchId?: string;
  disputeId?: string;
  errorType?: string;
  errorCode?: string;
}) {
  process.stdout.write(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'ggvault-api',
      level: fields.level,
      event: fields.event,
      requestId: fields.requestId,
      method: fields.method,
      route: fields.route,
      statusCode: fields.statusCode,
      durationMs: fields.durationMs,
      actorUserId: fields.actorUserId,
      challengeId: fields.challengeId,
      matchId: fields.matchId,
      disputeId: fields.disputeId,
      errorType: fields.errorType,
      errorCode: fields.errorCode,
    }) + '\n',
  );
}
export function requestObservation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const supplied = req.headers['x-request-id'];
  const requestId =
    typeof supplied === 'string' &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      supplied,
    )
      ? supplied
      : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const start = performance.now();
  res.on('finish', () => {
    const durationMs = performance.now() - start;
    // Express route templates only: never query strings, IDs or arbitrary unmatched paths.
    const route =
      typeof req.route?.path === 'string' ? req.route.path : 'unmatched';
    const method = [
      'GET',
      'POST',
      'PATCH',
      'PUT',
      'DELETE',
      'OPTIONS',
      'HEAD',
    ].includes(req.method)
      ? req.method
      : 'OTHER';
    const labels = `method="${method}",route="${route}",status="${res.statusCode}"`;
    const item = observations.get(labels) ?? {
      count: 0,
      sum: 0,
      buckets: bounds.map(() => 0),
    };
    item.count++;
    item.sum += durationMs / 1000;
    bounds.forEach((bound, index) => {
      if (durationMs / 1000 <= bound) item.buckets[index]++;
    });
    observations.set(labels, item);
    const actorUserId = (req as Request & { user?: { sub: string } }).user?.sub;
    const candidate = String(req.params?.id ?? req.params?.challengeId ?? '');
    const objectId = /^c[a-z0-9]{24}$/.test(candidate) ? candidate : undefined;
    structuredLog({
      level: res.statusCode >= 500 ? 'ERROR' : 'INFO',
      event: 'http_request',
      requestId,
      method,
      route,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      actorUserId,
      challengeId: route.startsWith('/challenges/') ? objectId : undefined,
      matchId: route.startsWith('/matches/') ? objectId : undefined,
      disputeId: route.startsWith('/moderation/disputes/')
        ? objectId
        : undefined,
    });
  });
  next();
}
export function httpMetrics() {
  const lines = [
    '# TYPE ggvault_http_requests_total counter',
    '# TYPE ggvault_http_duration_seconds histogram',
  ];
  for (const [labels, item] of observations) {
    lines.push(`ggvault_http_requests_total{${labels}} ${item.count}`);
    bounds.forEach((bound, index) =>
      lines.push(
        `ggvault_http_duration_seconds_bucket{${labels},le="${bound}"} ${item.buckets[index]}`,
      ),
    );
    lines.push(
      `ggvault_http_duration_seconds_bucket{${labels},le="+Inf"} ${item.count}`,
      `ggvault_http_duration_seconds_sum{${labels}} ${item.sum}`,
      `ggvault_http_duration_seconds_count{${labels}} ${item.count}`,
    );
  }
  return lines.join('\n') + '\n';
}
