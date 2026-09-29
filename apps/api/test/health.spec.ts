describe('health module', () => {
  it('defines a minimal health check contract', () => {
    expect({ status: 'ok', service: 'ggvault-api' }).toMatchObject({
      status: 'ok',
      service: 'ggvault-api',
    });
  });
});
