module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: 'test/e2e/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['js', 'json', 'ts'],
  testTimeout: 30000,
  forceExit: true,
};
