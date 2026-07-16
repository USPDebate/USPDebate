module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js', '**/*.test.js'],
  // Config do Babel inline (não usar .babelrc: o Next detectaria e trocaria SWC por Babel, quebrando o build)
  transform: {
    '^.+\\.jsx?$': ['babel-jest', {
      presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
    }],
  },
  collectCoverageFrom: [
    'src/lib/*.js',
    '!src/lib/supabase.js', // tem dependências do Supabase, testamos separado
  ],
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 60,
      functions: 70,
      lines: 70,
    },
  },
};
