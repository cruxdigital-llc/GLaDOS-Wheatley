import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, setLogLevel, getLogLevel, initLogging } from '../logging.js';

describe('logging', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Reset to default level before each test
    setLogLevel('info');
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('default log level is info', () => {
    // After reset in beforeEach, the level should be info
    expect(getLogLevel()).toBe('info');
  });

  it('setLogLevel changes the level', () => {
    setLogLevel('debug');
    expect(getLogLevel()).toBe('debug');

    setLogLevel('error');
    expect(getLogLevel()).toBe('error');
  });

  it('debug messages not logged at info level', () => {
    setLogLevel('info');
    logger.debug('this should not appear');

    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it('error messages always logged at info level', () => {
    setLogLevel('info');
    logger.error('something went wrong');

    expect(stderrSpy).toHaveBeenCalledOnce();
    const output = stderrSpy.mock.calls[0][0] as string;
    expect(output).toContain('something went wrong');
    expect(output).toContain('"level":"error"');
  });
});
