import { authenticated, upstreamJson } from '../../../../web/lib/session';
type Summary = {
  users: number;
  openChallenges: number;
  activeMatches: number;
  openDisputes: number;
  settlementsToday: number;
  refundsToday: number;
  health: { status: string; api: string; postgresql: string; redis: string };
};
export default async function Operations() {
  let summary: Summary;
  try {
    summary = await upstreamJson<Summary>(
      await authenticated('/operations/summary'),
    );
  } catch {
    return (
      <section>
        <h1>Beta operations</h1>
        <p>
          Operations are available to administrators only. The service may also
          be temporarily unavailable.
        </p>
      </section>
    );
  }
  return (
    <section>
      <h1>Beta operations</h1>
      <p>TEST credits only. Daily counts use UTC. Refresh to update.</p>
      <dl>
        {Object.entries(summary)
          .filter(([key]) => key !== 'health')
          .map(([key, value]) => (
            <div className="card" key={key}>
              <dt>
                {
                  (
                    {
                      users: 'Registered users',
                      openChallenges: 'Open challenges',
                      activeMatches: 'Active matches',
                      openDisputes: 'Open disputes',
                      settlementsToday: 'Settlements today',
                      refundsToday: 'Refunds today',
                    } as Record<string, string>
                  )[key]
                }
              </dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
      </dl>
      <h2>System health</h2>
      <dl>
        {Object.entries(summary.health).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
