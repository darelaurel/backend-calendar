const devConfig = require('./dev')

const envConfig = {
    dev: devConfig,
}

const env = 'dev'

module.exports = {
    ...envConfig[env]
}