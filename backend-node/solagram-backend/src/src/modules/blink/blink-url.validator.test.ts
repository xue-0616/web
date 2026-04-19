import { isTrustedBlinkUrl, normaliseHost } from './blink-url.validator';

describe('normaliseHost', () => {
  it('lowercases', () => {
    expect(normaliseHost('FOO.COM')).toBe('foo.com');
  });
  it('strips leading www.', () => {
    expect(normaliseHost('www.foo.com')).toBe('foo.com');
  });
  it('does not strip other subdomains', () => {
    expect(normaliseHost('api.foo.com')).toBe('api.foo.com');
  });
  it('trims whitespace', () => {
    expect(normaliseHost('  foo.com  ')).toBe('foo.com');
  });
});

describe('isTrustedBlinkUrl (BUG-S1)', () => {
  const TRUSTED = ['dial.to', 'jupiter.actions.dialect.to', 'foo.com'];

  describe('host matching', () => {
    it('accepts a trusted host', () => {
      const r = isTrustedBlinkUrl('https://dial.to/some/path', TRUSTED);
      expect(r.ok).toBe(true);
      expect(r.host).toBe('dial.to');
    });

    it('accepts www.* variant when bare host is trusted', () => {
      expect(isTrustedBlinkUrl('https://www.foo.com', TRUSTED).ok).toBe(true);
    });

    it('rejects look-alike longer host (foo.com.evil.com)', () => {
      const r = isTrustedBlinkUrl('https://foo.com.evil.com/x', TRUSTED);
      expect(r.ok).toBe(false);
      expect(r.reason).toMatch(/not in trusted/);
    });

    it('rejects host prefix bypass (xfoo.com)', () => {
      expect(isTrustedBlinkUrl('https://xfoo.com', TRUSTED).ok).toBe(false);
    });

    it('rejects arbitrary subdomain not explicitly listed', () => {
      // evil.foo.com is NOT a substring-subdomain shortcut
      expect(isTrustedBlinkUrl('https://evil.foo.com', TRUSTED).ok).toBe(false);
    });

    it('accepts explicitly listed subdomain', () => {
      const r = isTrustedBlinkUrl(
        'https://jupiter.actions.dialect.to/swap',
        TRUSTED,
      );
      expect(r.ok).toBe(true);
    });
  });

  describe('protocol checks', () => {
    it('rejects http://', () => {
      expect(isTrustedBlinkUrl('http://dial.to', TRUSTED).ok).toBe(false);
    });
    it('rejects javascript: scheme', () => {
      expect(isTrustedBlinkUrl('javascript:alert(1)', TRUSTED).ok).toBe(false);
    });
    it('rejects data: scheme', () => {
      expect(isTrustedBlinkUrl('data:text/html,foo', TRUSTED).ok).toBe(false);
    });
    it('rejects ftp://', () => {
      expect(isTrustedBlinkUrl('ftp://dial.to', TRUSTED).ok).toBe(false);
    });
  });

  describe('credential embed', () => {
    it('rejects URL with username', () => {
      expect(
        isTrustedBlinkUrl('https://user@dial.to', TRUSTED).ok,
      ).toBe(false);
    });
    it('rejects URL with user:pass', () => {
      expect(
        isTrustedBlinkUrl('https://u:p@dial.to', TRUSTED).ok,
      ).toBe(false);
    });
  });

  describe('malformed input', () => {
    it('rejects empty string', () => {
      expect(isTrustedBlinkUrl('', TRUSTED).ok).toBe(false);
    });
    it('rejects non-string', () => {
      expect(isTrustedBlinkUrl(null, TRUSTED).ok).toBe(false);
      expect(isTrustedBlinkUrl(123, TRUSTED).ok).toBe(false);
      expect(isTrustedBlinkUrl({}, TRUSTED).ok).toBe(false);
    });
    it('rejects garbage', () => {
      expect(isTrustedBlinkUrl('not a url', TRUSTED).ok).toBe(false);
    });
  });

  describe('empty trusted list', () => {
    it('rejects everything', () => {
      expect(isTrustedBlinkUrl('https://dial.to', []).ok).toBe(false);
    });
  });
});
