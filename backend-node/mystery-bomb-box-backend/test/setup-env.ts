// Minimal test-env setup. The jest config under package.json expects
// this file to exist; keep it small so tests stay isolated and don't
// accidentally pick up production secrets from `.env`.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
