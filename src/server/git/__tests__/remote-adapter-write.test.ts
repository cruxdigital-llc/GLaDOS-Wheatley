import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemoteGitAdapter } from '../remote-adapter.js';
import { ConflictError } from '../types.js';

// Mock Octokit — extend the existing mock with write operations
vi.mock('@octokit/rest', () => {
  const mockGetContent = vi.fn();
  const mockListBranches = vi.fn();
  const mockGet = vi.fn();
  const mockGetBranch = vi.fn();
  const mockCreateOrUpdateFileContents = vi.fn();

  return {
    Octokit: vi.fn().mockImplementation(() => ({
      repos: {
        getContent: mockGetContent,
        listBranches: mockListBranches,
        get: mockGet,
        getBranch: mockGetBranch,
        createOrUpdateFileContents: mockCreateOrUpdateFileContents,
      },
    })),
    __mockGetContent: mockGetContent,
    __mockListBranches: mockListBranches,
    __mockGet: mockGet,
    __mockGetBranch: mockGetBranch,
    __mockCreateOrUpdateFileContents: mockCreateOrUpdateFileContents,
  };
});

async function getMocks() {
  const mod = await import('@octokit/rest');
  return {
    mockGetContent: (mod as Record<string, unknown>).__mockGetContent as ReturnType<typeof vi.fn>,
    mockGet: (mod as Record<string, unknown>).__mockGet as ReturnType<typeof vi.fn>,
    mockCreateOrUpdateFileContents: (mod as Record<string, unknown>).__mockCreateOrUpdateFileContents as ReturnType<typeof vi.fn>,
  };
}

describe('RemoteGitAdapter.writeFile', () => {
  let adapter: RemoteGitAdapter;

  beforeEach(async () => {
    const { mockGetContent, mockGet, mockCreateOrUpdateFileContents } = await getMocks();
    mockGetContent.mockReset();
    mockGet.mockReset();
    mockCreateOrUpdateFileContents.mockReset();

    // Default: getDefaultBranch returns 'main'
    mockGet.mockResolvedValue({ data: { default_branch: 'main' } });

    adapter = new RemoteGitAdapter({
      token: 'ghp_test',
      owner: 'test-org',
      repo: 'test-repo',
    });
  });

  describe('successful writes', () => {
    it('creates a new file when it does not exist (no SHA)', async () => {
      const { mockGetContent, mockCreateOrUpdateFileContents } = await getMocks();

      // File does not exist — getContent throws 404-like error
      mockGetContent.mockRejectedValue(new Error('Not Found'));
      mockCreateOrUpdateFileContents.mockResolvedValue({ data: {} });

      await adapter.writeFile('product-knowledge/claims.md', '# Claims\n', 'init claims', 'main');

      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-org',
          repo: 'test-repo',
          path: 'product-knowledge/claims.md',
          message: 'init claims',
          content: Buffer.from('# Claims\n').toString('base64'),
          branch: 'main',
        }),
      );
      // SHA should NOT be included when file is new
      const call = mockCreateOrUpdateFileContents.mock.calls[0][0] as Record<string, unknown>;
      expect(call).not.toHaveProperty('sha');
    });

    it('updates an existing file with current SHA', async () => {
      const { mockGetContent, mockCreateOrUpdateFileContents } = await getMocks();
      const existingSha = 'abc123def456';
      const content = '# Claims\n\n- [claimed] 1.1.1 | tester | 2026-03-28T10:00:00Z\n';

      mockGetContent.mockResolvedValue({
        data: { type: 'file', sha: existingSha, content: '' },
      });
      mockCreateOrUpdateFileContents.mockResolvedValue({ data: {} });

      await adapter.writeFile('product-knowledge/claims.md', content, 'claim: 1.1.1', 'main');

      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          sha: existingSha,
          content: Buffer.from(content).toString('base64'),
        }),
      );
    });

    it('uses the default branch when branch is omitted', async () => {
      const { mockGetContent, mockCreateOrUpdateFileContents } = await getMocks();
      mockGetContent.mockRejectedValue(new Error('Not Found'));
      mockCreateOrUpdateFileContents.mockResolvedValue({ data: {} });

      await adapter.writeFile('product-knowledge/claims.md', '# Claims\n', 'init');

      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({ branch: 'main' }),
      );
    });

    it('encodes content as base64', async () => {
      const { mockGetContent, mockCreateOrUpdateFileContents } = await getMocks();
      mockGetContent.mockRejectedValue(new Error('Not Found'));
      mockCreateOrUpdateFileContents.mockResolvedValue({ data: {} });

      const content = 'hello world\n';
      await adapter.writeFile('product-knowledge/claims.md', content, 'test encode');

      const call = mockCreateOrUpdateFileContents.mock.calls[0][0] as Record<string, unknown>;
      expect(call.content).toBe(Buffer.from(content).toString('base64'));
    });
  });

  describe('conflict detection', () => {
    it('throws ConflictError when GitHub API returns 409', async () => {
      const { mockGetContent, mockCreateOrUpdateFileContents } = await getMocks();
      mockGetContent.mockRejectedValue(new Error('Not Found'));

      const conflictError = Object.assign(new Error('Conflict'), { status: 409 });
      mockCreateOrUpdateFileContents.mockRejectedValue(conflictError);

      await expect(
        adapter.writeFile('product-knowledge/claims.md', '# Claims\n', 'test conflict'),
      ).rejects.toThrow(ConflictError);
    });

    it('ConflictError message references the file path', async () => {
      const { mockGetContent, mockCreateOrUpdateFileContents } = await getMocks();
      mockGetContent.mockRejectedValue(new Error('Not Found'));

      const conflictError = Object.assign(new Error('Conflict'), { status: 409 });
      mockCreateOrUpdateFileContents.mockRejectedValue(conflictError);

      await expect(
        adapter.writeFile('product-knowledge/claims.md', '# Claims\n', 'test conflict'),
      ).rejects.toThrow(/claims\.md/);
    });

    it('rethrows non-409 errors without wrapping', async () => {
      const { mockGetContent, mockCreateOrUpdateFileContents } = await getMocks();
      mockGetContent.mockRejectedValue(new Error('Not Found'));

      const authError = Object.assign(new Error('Unauthorized'), { status: 401 });
      mockCreateOrUpdateFileContents.mockRejectedValue(authError);

      await expect(
        adapter.writeFile('product-knowledge/claims.md', '# Claims\n', 'test auth error'),
      ).rejects.toThrow('Unauthorized');

      // Should NOT be wrapped as ConflictError
      await expect(
        adapter.writeFile('product-knowledge/claims.md', '# Claims\n', 'test auth error 2'),
      ).rejects.not.toThrow(ConflictError);
    });
  });

  describe('SHA resolution', () => {
    it('does not include SHA when getContent returns a directory', async () => {
      const { mockGetContent, mockCreateOrUpdateFileContents } = await getMocks();
      // Returns a directory listing (array) rather than a file
      mockGetContent.mockResolvedValue({
        data: [{ name: 'product-knowledge/claims.md', type: 'file', path: 'product-knowledge/claims.md' }],
      });
      mockCreateOrUpdateFileContents.mockResolvedValue({ data: {} });

      await adapter.writeFile('product-knowledge/claims.md', '# Claims\n', 'test dir');

      const call = mockCreateOrUpdateFileContents.mock.calls[0][0] as Record<string, unknown>;
      expect(call).not.toHaveProperty('sha');
    });
  });
});
