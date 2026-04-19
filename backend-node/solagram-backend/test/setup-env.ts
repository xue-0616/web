// Minimal jest setup — see audit note in matching file for
// mystery-bomb-box-backend. Don't accidentally load production `.env`.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
