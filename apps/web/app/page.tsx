export default function Home() {
  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto' }}>
      <h1>GGVault v0.1</h1>
      <p>
        Competitive gaming challenge platform with non-withdrawable test credits, PostgreSQL, and
        Redis-backed service orchestration.
      </p>
      <ul>
        <li>Public web experience</li>
        <li>API health checks</li>
        <li>Challenge infrastructure foundation</li>
        <li>Test-credit ledger only</li>
      </ul>
    </main>
  );
}
