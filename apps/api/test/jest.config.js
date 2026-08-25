module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  testRegex: 'test/unit/.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['js', 'json', 'ts'],
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: '../coverage',
};
