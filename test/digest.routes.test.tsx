import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir };

const line = (o: Record<string, unknown>) => JSON.stringify(o);

beforeAll(() => {
  writeFileSync(
    join(dir, '2026-01-01.jsonl'),
    [
      line({ at: '2026-01-01T23:00:00+01:00', job: 'b/job', status: 'ok', owner: 'rook' }),
      line({ at: '2026-01-01T23:05:00+01:00', job: 'a/job', status: 'fail', owner: null, error: 'boom' }),
    ].join('\n') + '\n',
  );
  writeFileSync(join(dir, '2026-01-02.jsonl'), '');
  writeFileSync(
    join(dir, '2026-01-03.jsonl'),
    [line({ at: '2026-01-03T01:00:00+01:00', job: 'x', status: 'ok', owner: 'rook' }), '{"at":"2026-01-03T0'].join('\n'),
  );
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('GET /digest/:night', () => {
  it('renders the rows sorted by job and marks a fail', async () => {
    const res = await createApp(config).request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('a/job')).toBeGreaterThan(-1);
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html).toContain('⚠ a/job');
    expect(html).toContain('—');
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config).request('/digest/2025-12-31');
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await createApp(config).request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders a night with a bad line and reports it', async () => {
    const res = await createApp(config).request('/digest/2026-01-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 line could not be read');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the same jobs in the same order as the page', async () => {
    const app = createApp(config);
    const json = (await (await app.request('/api/digest/2026-01-01')).json()) as { rows: { job: string }[] };
    expect(json.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
    const html = await (await app.request('/digest/2026-01-01')).text();
    expect(html.indexOf(json.rows[0]!.job)).toBeLessThan(html.indexOf(json.rows[1]!.job));
  });

  it('404 for a night with no file', async () => {
    const res = await createApp(config).request('/api/digest/2025-12-31');
    expect(res.status).toBe(404);
  });

  it('returns no rows for the empty night', async () => {
    const json = (await (await createApp(config).request('/api/digest/2026-01-02')).json()) as { rows: unknown[] };
    expect(json.rows).toEqual([]);
  });

  it('counts the bad line', async () => {
    const json = (await (await createApp(config).request('/api/digest/2026-01-03')).json()) as { badLines: number };
    expect(json.badLines).toBe(1);
  });
});

describe('status board', () => {
  it('links each night to its digest with counts', async () => {
    const html = await (await createApp({ ...config, runsDir: 'runs' }).request('/')).text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('fail 1');
  });
});
