import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { LocalFileWatcher } from '../local-watcher.js';

describe('LocalFileWatcher', () => {
  let fixtureDir: string;

  beforeAll(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'wheatley-watcher-'));
    // Create a minimal .git structure
    await mkdir(join(fixtureDir, '.git', 'refs', 'heads'), { recursive: true });
    await writeFile(join(fixtureDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    await writeFile(join(fixtureDir, '.git', 'refs', 'heads', 'main'), 'abc123\n');
  });

  afterAll(async () => {
    await rm(fixtureDir, { recursive: true, force: true });
  });

  it('starts and stops without error', () => {
    const watcher = new LocalFileWatcher(fixtureDir, vi.fn());
    expect(() => watcher.start()).not.toThrow();
    expect(() => watcher.stop()).not.toThrow();
  });

  it('handles non-existent repo path gracefully', () => {
    const watcher = new LocalFileWatcher('/tmp/does-not-exist-ever', vi.fn());
    expect(() => watcher.start()).not.toThrow();
    expect(() => watcher.stop()).not.toThrow();
  });

  it('detects HEAD changes', async () => {
    const onChange = vi.fn();
    const watcher = new LocalFileWatcher(fixtureDir, onChange);
    watcher.start();

    // Give fs.watch time to initialize
    await new Promise((r) => setTimeout(r, 100));

    // Modify HEAD to simulate branch switch
    await writeFile(join(fixtureDir, '.git', 'HEAD'), 'ref: refs/heads/feature\n');

    // Wait for fs event
    await new Promise((r) => setTimeout(r, 300));

    watcher.stop();
    expect(onChange).toHaveBeenCalled();
  });

  it('detects ref changes', async () => {
    const onChange = vi.fn();
    const watcher = new LocalFileWatcher(fixtureDir, onChange);
    watcher.start();

    await new Promise((r) => setTimeout(r, 100));

    // Modify ref to simulate new commit
    await writeFile(join(fixtureDir, '.git', 'refs', 'heads', 'main'), 'def456\n');

    await new Promise((r) => setTimeout(r, 300));

    watcher.stop();
    expect(onChange).toHaveBeenCalled();
  });

  it('can be stopped and restarted', () => {
    const watcher = new LocalFileWatcher(fixtureDir, vi.fn());
    watcher.start();
    watcher.stop();
    watcher.start();
    watcher.stop();
    // No assertions needed — just verify no errors
  });
});
