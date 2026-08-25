module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: 'test/e2e/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['js', 'json', 'ts'],
  // Bumped from 30s: e2e tests hit a real remote Postgres (Neon) now, not a local instance,
  // and each fact-sheet operation is several sequential round trips — see docs/BUILD_STATUS.md.
  testTimeout: 60000,
  forceExit: true,
  // Each e2e spec boots a full Nest app (its own Prisma + BullMQ/Redis connections). Against a
  // remote/pooled database (e.g. Neon) running multiple of those concurrently can transiently
  // exhaust the pooler's connection burst limit — run spec files one at a time.
  maxWorkers: 1,
};
