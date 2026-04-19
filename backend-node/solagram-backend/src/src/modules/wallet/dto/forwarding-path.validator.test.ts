import {
  MAX_PATH_CHARS,
  validateForwardingPath,
} from './forwarding-path.validator';

describe('validateForwardingPath (BUG-S3)', () => {
  describe('accepts', () => {
    it('a plain endpoint path', () => {
      expect(validateForwardingPath('/rpc').ok).toBe(true);
    });
    it('nested path with hyphens and underscores', () => {
      expect(validateForwardingPath('/auth/verify_message-v2').ok).toBe(true);
    });
    it('path with a single dot (extensions)', () => {
      expect(validateForwardingPath('/assets/favicon.ico').ok).toBe(true);
    });
    it('path at MAX_PATH_CHARS', () => {
      expect(
        validateForwardingPath('/' + 'a'.repeat(MAX_PATH_CHARS - 1)).ok,
      ).toBe(true);
    });
  });

  describe('rejects BUG-S3 attack shapes', () => {
    it('protocol-relative hijack //evil.com/x', () => {
      expect(validateForwardingPath('//evil.com/steal').ok).toBe(false);
    });
    it('path traversal /../../admin', () => {
      expect(validateForwardingPath('/../../admin').ok).toBe(false);
    });
    it('query-string injection /foo?api_key=xxx', () => {
      expect(validateForwardingPath('/foo?api_key=xxx').ok).toBe(false);
    });
    it('fragment injection /foo#bar', () => {
      expect(validateForwardingPath('/foo#bar').ok).toBe(false);
    });
    it('encoded traversal (we don\'t decode, but the literal %2e%2e is still rejected)', () => {
      // % is not in the safe alphabet, so encoded attempts fail.
      expect(validateForwardingPath('/%2e%2e/admin').ok).toBe(false);
    });
    it('CRLF in path (log-injection defence)', () => {
      expect(validateForwardingPath('/foo\r\nSet-Cookie: x').ok).toBe(false);
    });
    it('full URL passed as path', () => {
      expect(validateForwardingPath('https://evil.com/x').ok).toBe(false);
    });
    it('relative path without leading slash', () => {
      expect(validateForwardingPath('foo').ok).toBe(false);
    });
    it('empty path', () => {
      expect(validateForwardingPath('').ok).toBe(false);
    });
    it('over-long path (DoS defence)', () => {
      expect(
        validateForwardingPath('/' + 'a'.repeat(MAX_PATH_CHARS + 1)).ok,
      ).toBe(false);
    });
    it('non-string input', () => {
      expect(validateForwardingPath(123).ok).toBe(false);
      expect(validateForwardingPath(null).ok).toBe(false);
      expect(validateForwardingPath(undefined).ok).toBe(false);
    });
  });
});
