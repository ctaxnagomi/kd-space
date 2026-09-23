const { execSync } = require('child_process')
execSync('npx webpack --config ./bundler/webpack.prod.js', {
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: '--openssl-legacy-provider' }
})