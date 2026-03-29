import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoteGitAdapter } from '../remote-adapter.js';

// Mock Octokit
vi.mock('@octokit/rest', () => {
  const mockGetContent = vi.fn();
  const mockListBranches = vi.fn();
  const mockGet = vi.fn();

  return {
    Octokit: vi.fn().mockImplementation(() => ({
      repos: {
        getContent: mockGetContent,
        listBranches: mockListBranches,
        get: mockGet,
      },
    })),
    __mockGetContent: mockGetContent,
    __mockListBranches: mockListBranches,
    __mockGet: mockGet,
  };
});

async function getMocks() {
  const mod = await import('@octokit/rest');
  return {
    mockGetContent: (mod as Record<string, unknown>).__mockGetContent as ReturnType<typeof vi.fn>,
    mockListBranches: (mod as Record<string, unknown>).__mockListBranches as ReturnType<typeof vi.fn>,
    mockGet: (mod as Record<string, unknown>).__mockGet as ReturnType<typeof vi.fn>,
  };
}

describe('RemoteGitAdapter', () => {
  let adapter: RemoteGitAdapter;

  beforeEach(async () => {
    const { mockGetContent, mockListBranches, mockGet } = await getMocks();
    mockGetContent.mockReset();
    mockListBranches.mockReset();
    mockGet.mockReset();

    // Default: getDefaultBranch returns 'main'
    mockGet.mockResolvedValue({
      data: { default_branch: 'main' },
    });

    adapter = new RemoteGitAdapter({
      token: 'ghp_test',
      owner: 'cruxdigital-llc',
      repo: 'GLaDOS-Wheatley',
    });
  });

  describe('readFile', () => {
    it('reads and decodes a base64-encoded file', async () => {
      const { mockGetContent } = await getMocks();
      const content = Buffer.from('# Hello World\n').toString('base64');
      mockGetContent.mockResolvedValue({
        data: { type: 'file', content, encoding: 'base64' },
      });

      const result = await adapter.readFile('README.md');
      expect(result).toBe('# Hello World\n');
    });

    it('passes ref to the API', async () => {
      const { mockGetContent } = await getMocks();
      const content = Buffer.from('data').toString('base64');
      mockGetContent.mockResolvedValue({
        data: { type: 'file', content, encoding: 'base64' },
      });

      await adapter.readFile('file.md', 'feature-branch');
      expect(mockGetContent).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'feature-branch' }),
      );
    });

    it('uses default branch when no ref specified', async () => {
      const { mockGetContent } = await getMocks();
      const content = Buffer.from('data').toString('base64');
      mockGetContent.mockResolvedValue({
        data: { type: 'file', content, encoding: 'base64' },
      });

      await adapter.readFile('file.md');
      expect(mockGetContent).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'main' }),
      );
    });

    it('returns null if path is a directory', async () => {
      const { mockGetContent } = await getMocks();
      mockGetContent.mockResolvedValue({
        data: [{ name: 'file.md', type: 'file', path: 'dir/file.md' }],
      });

      const result = await adapter.readFile('dir');
      expect(result).toBeNull();
    });

    it('returns null on 404', async () => {
      const { mockGetContent } = await getMocks();
      mockGetContent.mockRejectedValue(new Error('Not Found'));

      const result = await adapter.readFile('does-not-exist.md');
      expect(result).toBeNull();
    });
  });

  describe('listDirectory', () => {
    it('lists directory entries', async () => {
      const { mockGetContent } = await getMocks();
      mockGetContent.mockResolvedValue({
        data: [
          { name: 'README.md', type: 'file', path: 'specs/README.md' },
          { name: 'subdir', type: 'dir', path: 'specs/subdir' },
        ],
      });

      const entries = await adapter.listDirectory('specs');
      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({
        name: 'README.md',
        type: 'file',
        path: 'specs/README.md',
      });
      expect(entries[1]).toEqual({
        name: 'subdir',
        type: 'directory',
        path: 'specs/subdir',
      });
    });

    it('returns empty array when path is a file', async () => {
      const { mockGetContent } = await getMocks();
      mockGetContent.mockResolvedValue({
        data: { type: 'file', content: 'abc', encoding: 'base64' },
      });

      const entries = await adapter.listDirectory('file.md');
      expect(entries).toEqual([]);
    });

    it('returns empty array on error', async () => {
      const { mockGetContent } = await getMocks();
      mockGetContent.mockRejectedValue(new Error('Not Found'));

      const entries = await adapter.listDirectory('no-dir');
      expect(entries).toEqual([]);
    });
  });

  describe('listBranches', () => {
    it('returns branch names', async () => {
      const { mockListBranches } = await getMocks();
      mockListBranches.mockResolvedValue({
        data: [{ name: 'main' }, { name: 'develop' }, { name: 'feature' }],
      });

      const branches = await adapter.listBranches();
      expect(branches).toEqual(['main', 'develop', 'feature']);
    });

    it('returns empty array on error', async () => {
      const { mockListBranches } = await getMocks();
      mockListBranches.mockRejectedValue(new Error('Unauthorized'));

      const branches = await adapter.listBranches();
      expect(branches).toEqual([]);
    });

    it('paginates when more than 100 branches', async () => {
      const { mockListBranches } = await getMocks();
      const page1 = Array.from({ length: 100 }, (_, i) => ({
        name: `branch-${i}`,
      }));
      const page2 = [{ name: 'branch-100' }, { name: 'branch-101' }];

      mockListBranches
        .mockResolvedValueOnce({ data: page1 })
        .mockResolvedValueOnce({ data: page2 });

      const branches = await adapter.listBranches();
      expect(branches).toHaveLength(102);
    });
  });

  describe('getCurrentBranch', () => {
    it('returns the default branch', async () => {
      const branch = await adapter.getCurrentBranch();
      expect(branch).toBe('main');
    });
  });

  describe('getDefaultBranch', () => {
    it('returns the repo default branch', async () => {
      const branch = await adapter.getDefaultBranch();
      expect(branch).toBe('main');
    });

    it('caches the default branch', async () => {
      const { mockGet } = await getMocks();
      await adapter.getDefaultBranch();
      await adapter.getDefaultBranch();
      // Should only call the API once
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it('returns main on error', async () => {
      const { mockGet } = await getMocks();
      mockGet.mockReset();
      mockGet.mockRejectedValue(new Error('Unauthorized'));

      // Need fresh adapter without cache
      const freshAdapter = new RemoteGitAdapter({
        token: 'bad',
        owner: 'org',
        repo: 'repo',
      });
      const branch = await freshAdapter.getDefaultBranch();
      expect(branch).toBe('main');
    });
  });
});
