import {
  MAX_KEY_ENCRYPTED_CHARS,
  MIN_KEY_ENCRYPTED_CHARS,
  validateKeyUpload,
} from './encrypted-key.validator';

// A plausible 32-char base64 payload and a Solana pubkey for reuse
// across test cases.
const OK_KEY = 'a'.repeat(60); // 60 chars, base64-ish
const OK_ADDR = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

describe('validateKeyUpload (BUG-S5)', () => {
  describe('address validation', () => {
    it('accepts a canonical Solana pubkey', () => {
      expect(validateKeyUpload(OK_KEY, OK_ADDR).ok).toBe(true);
    });
    it('rejects too-short addresses', () => {
      expect(validateKeyUpload(OK_KEY, 'short').ok).toBe(false);
    });
    it('rejects too-long addresses', () => {
      expect(validateKeyUpload(OK_KEY, 'a'.repeat(50)).ok).toBe(false);
    });
    it('rejects addresses with non-base58 characters', () => {
      // '0' (zero) is excluded from base58
      expect(
        validateKeyUpload(OK_KEY, '0'.repeat(44)).ok,
      ).toBe(false);
    });
    it('rejects addresses with CRLF (log-injection defence)', () => {
      expect(
        validateKeyUpload(OK_KEY, OK_ADDR + '\n').ok,
      ).toBe(false);
    });
    it('rejects non-string address', () => {
      expect(validateKeyUpload(OK_KEY, 123).ok).toBe(false);
      expect(validateKeyUpload(OK_KEY, null).ok).toBe(false);
    });
  });

  describe('keyEncrypted validation', () => {
    it('accepts well-formed base64 at minimum length', () => {
      // 32 chars of alphabet + one padding segment
      const s = 'abcDEFghij0123456789+/ABCDEFGH=='; // 32 chars
      expect(validateKeyUpload(s, OK_ADDR).ok).toBe(true);
    });
    it('accepts base64url variants', () => {
      const s = 'abc_DEF-123xyzABC_-0123456789__AB'; // 33 chars
      expect(validateKeyUpload(s, OK_ADDR).ok).toBe(true);
    });
    it('rejects shorter than MIN', () => {
      expect(
        validateKeyUpload('a'.repeat(MIN_KEY_ENCRYPTED_CHARS - 1), OK_ADDR).ok,
      ).toBe(false);
    });
    it('rejects larger than MAX (DoS defence)', () => {
      expect(
        validateKeyUpload('a'.repeat(MAX_KEY_ENCRYPTED_CHARS + 1), OK_ADDR).ok,
      ).toBe(false);
    });
    it('rejects non-base64 characters', () => {
      expect(validateKeyUpload('hello world! ' + 'a'.repeat(40), OK_ADDR).ok).toBe(false);
    });
    it('rejects non-string input', () => {
      expect(validateKeyUpload(123, OK_ADDR).ok).toBe(false);
      expect(validateKeyUpload({ foo: 'bar' }, OK_ADDR).ok).toBe(false);
    });
  });

  describe('boundaries', () => {
    it('accepts exactly MIN chars', () => {
      expect(
        validateKeyUpload('a'.repeat(MIN_KEY_ENCRYPTED_CHARS), OK_ADDR).ok,
      ).toBe(true);
    });
    it('accepts exactly MAX chars', () => {
      expect(
        validateKeyUpload('a'.repeat(MAX_KEY_ENCRYPTED_CHARS), OK_ADDR).ok,
      ).toBe(true);
    });
  });
});
