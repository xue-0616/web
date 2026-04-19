// Ambient declarations for third-party modules that do not ship types
// and whose @types/* packages are not installed in the repo.
//
// If you later run `npm i -D @types/lodash @types/node-apollo` these
// stubs become harmless.

declare module 'lodash';
declare module 'node-apollo';
