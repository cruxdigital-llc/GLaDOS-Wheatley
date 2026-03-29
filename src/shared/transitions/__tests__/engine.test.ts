import { describe, it, expect } from 'vitest';
import { validateTransition, getTransitionActions } from '../engine.js';
import { VALID_TRANSITIONS } from '../types.js';

// ---------------------------------------------------------------------------
// validateTransition — valid transitions
// ---------------------------------------------------------------------------

describe('validateTransition — valid transitions', () => {
  it('allows unclaimed → planning', () => {
    expect(validateTransition('unclaimed', 'planning')).toEqual({ valid: true });
  });

  it('allows unclaimed → implementing (fast-track shortcut)', () => {
    expect(validateTransition('unclaimed', 'implementing')).toEqual({ valid: true });
  });

  it('allows planning → speccing', () => {
    expect(validateTransition('planning', 'speccing')).toEqual({ valid: true });
  });

  it('allows speccing → implementing', () => {
    expect(validateTransition('speccing', 'implementing')).toEqual({ valid: true });
  });

  it('allows implementing → verifying', () => {
    expect(validateTransition('implementing', 'verifying')).toEqual({ valid: true });
  });

  it('allows verifying → done', () => {
    expect(validateTransition('verifying', 'done')).toEqual({ valid: true });
  });

  it('every entry in VALID_TRANSITIONS returns valid: true', () => {
    for (const [from, targets] of VALID_TRANSITIONS) {
      for (const to of targets) {
        const result = validateTransition(from, to);
        expect(result.valid, `expected ${from} → ${to} to be valid`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// validateTransition — invalid transitions
// ---------------------------------------------------------------------------

describe('validateTransition — invalid transitions', () => {
  it('rejects unclaimed → done (multi-phase skip)', () => {
    const result = validateTransition('unclaimed', 'done');
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('rejects unclaimed → speccing (partial skip)', () => {
    const result = validateTransition('unclaimed', 'speccing');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('unclaimed');
    expect(result.reason).toContain('speccing');
  });

  it('rejects unclaimed → verifying', () => {
    expect(validateTransition('unclaimed', 'verifying').valid).toBe(false);
  });

  it('rejects planning → implementing (skips speccing, not a permitted shortcut)', () => {
    const result = validateTransition('planning', 'implementing');
    expect(result.valid).toBe(false);
  });

  it('rejects planning → done', () => {
    expect(validateTransition('planning', 'done').valid).toBe(false);
  });

  it('rejects implementing → done (skips verifying)', () => {
    expect(validateTransition('implementing', 'done').valid).toBe(false);
  });

  it('rejects backward transition: planning → unclaimed', () => {
    const result = validateTransition('planning', 'unclaimed');
    expect(result.valid).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it('rejects backward transition: done → verifying', () => {
    expect(validateTransition('done', 'verifying').valid).toBe(false);
  });

  it('rejects same-phase transition: implementing → implementing', () => {
    expect(validateTransition('implementing', 'implementing').valid).toBe(false);
  });

  it('rejects same-phase transition: done → done', () => {
    expect(validateTransition('done', 'done').valid).toBe(false);
  });

  it('returns valid: false (not throw) for invalid transitions', () => {
    expect(() => validateTransition('done', 'unclaimed')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getTransitionActions — correct files for each transition
// ---------------------------------------------------------------------------

describe('getTransitionActions — unclaimed → planning', () => {
  it('returns exactly one action', () => {
    const actions = getTransitionActions('3.1.2', 'unclaimed', 'planning');
    expect(actions).toHaveLength(1);
  });

  it('action path ends with README.md inside a spec dir', () => {
    const actions = getTransitionActions('3.1.2', 'unclaimed', 'planning');
    expect(actions[0].path).toMatch(/^specs\/.+\/README\.md$/);
  });

  it('spec dir slug uses hyphens not dots', () => {
    const actions = getTransitionActions('3.1.2', 'unclaimed', 'planning');
    expect(actions[0].path).toContain('3-1-2');
    expect(actions[0].path).not.toContain('3.1.2');
  });

  it('action has create: true', () => {
    const actions = getTransitionActions('3.1.2', 'unclaimed', 'planning');
    expect(actions[0].create).toBe(true);
  });

  it('README content includes the item ID', () => {
    const actions = getTransitionActions('3.1.2', 'unclaimed', 'planning');
    expect(actions[0].content).toContain('3.1.2');
  });
});

describe('getTransitionActions — planning → speccing', () => {
  it('returns exactly two actions', () => {
    const actions = getTransitionActions('3.1.2', 'planning', 'speccing');
    expect(actions).toHaveLength(2);
  });

  it('one action is for spec.md', () => {
    const actions = getTransitionActions('3.1.2', 'planning', 'speccing');
    expect(actions.some((a) => a.path.endsWith('spec.md'))).toBe(true);
  });

  it('one action is for requirements.md', () => {
    const actions = getTransitionActions('3.1.2', 'planning', 'speccing');
    expect(actions.some((a) => a.path.endsWith('requirements.md'))).toBe(true);
  });

  it('both actions have create: true', () => {
    const actions = getTransitionActions('3.1.2', 'planning', 'speccing');
    expect(actions.every((a) => a.create)).toBe(true);
  });
});

describe('getTransitionActions — speccing → implementing', () => {
  it('returns exactly one tasks.md action', () => {
    const actions = getTransitionActions('3.1.2', 'speccing', 'implementing');
    expect(actions).toHaveLength(1);
    expect(actions[0].path).toMatch(/tasks\.md$/);
  });

  it('tasks.md content has unchecked checkbox', () => {
    const actions = getTransitionActions('3.1.2', 'speccing', 'implementing');
    expect(actions[0].content).toContain('- [ ]');
  });

  it('tasks.md action has create: true', () => {
    const actions = getTransitionActions('3.1.2', 'speccing', 'implementing');
    expect(actions[0].create).toBe(true);
  });
});

describe('getTransitionActions — implementing → verifying', () => {
  it('returns exactly one tasks.md action', () => {
    const actions = getTransitionActions('3.1.2', 'implementing', 'verifying');
    expect(actions).toHaveLength(1);
    expect(actions[0].path).toMatch(/tasks\.md$/);
  });

  it('tasks.md content has checked checkbox [x]', () => {
    const actions = getTransitionActions('3.1.2', 'implementing', 'verifying');
    expect(actions[0].content).toContain('[x]');
  });

  it('tasks.md action has create: false (overwrite)', () => {
    const actions = getTransitionActions('3.1.2', 'implementing', 'verifying');
    expect(actions[0].create).toBe(false);
  });
});

describe('getTransitionActions — verifying → done', () => {
  it('returns exactly one action targeting ROADMAP.md', () => {
    const actions = getTransitionActions('3.1.2', 'verifying', 'done');
    expect(actions).toHaveLength(1);
    expect(actions[0].path).toBe('ROADMAP.md');
  });

  it('content includes MARK_DONE sentinel with item ID', () => {
    const actions = getTransitionActions('3.1.2', 'verifying', 'done');
    expect(actions[0].content).toBe('MARK_DONE:3.1.2');
  });

  it('action has create: false', () => {
    const actions = getTransitionActions('3.1.2', 'verifying', 'done');
    expect(actions[0].create).toBe(false);
  });
});

describe('getTransitionActions — unclaimed → implementing (shortcut)', () => {
  it('returns exactly two actions', () => {
    const actions = getTransitionActions('3.1.2', 'unclaimed', 'implementing');
    expect(actions).toHaveLength(2);
  });

  it('includes a README.md action', () => {
    const actions = getTransitionActions('3.1.2', 'unclaimed', 'implementing');
    expect(actions.some((a) => a.path.endsWith('README.md'))).toBe(true);
  });

  it('includes a tasks.md action', () => {
    const actions = getTransitionActions('3.1.2', 'unclaimed', 'implementing');
    expect(actions.some((a) => a.path.endsWith('tasks.md'))).toBe(true);
  });

  it('spec dir uses the item ID slug', () => {
    const actions = getTransitionActions('3.1.2', 'unclaimed', 'implementing');
    expect(actions.every((a) => a.path.includes('3-1-2'))).toBe(true);
  });
});

describe('getTransitionActions — invalid transition', () => {
  it('returns empty array for unclaimed → done', () => {
    expect(getTransitionActions('1.1.1', 'unclaimed', 'done')).toEqual([]);
  });

  it('returns empty array for done → unclaimed', () => {
    expect(getTransitionActions('1.1.1', 'done', 'unclaimed')).toEqual([]);
  });

  it('returns empty array for same-phase transition', () => {
    expect(getTransitionActions('1.1.1', 'planning', 'planning')).toEqual([]);
  });
});
