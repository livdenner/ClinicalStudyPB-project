const withE2eCleartextTraffic = require('./plugins/withE2eCleartextTraffic');

/**
 * Estende o `app.json`. Com `CLINICALSTUDYPB_E2E=1`, o build de Android aceita
 * HTTP para alcançar a stack de teste no emulador (E2E com Maestro, T23.5).
 */
module.exports = ({ config }) =>
  process.env.CLINICALSTUDYPB_E2E === '1'
    ? withE2eCleartextTraffic(config)
    : config;
