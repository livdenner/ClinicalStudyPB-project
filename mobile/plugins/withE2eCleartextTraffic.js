const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Libera HTTP sem TLS no Android apenas no build de E2E (T23.5).
 *
 * No emulador, o app fala com a stack de teste em `http://10.0.2.2:18080`, e um
 * build de release bloqueia esse tráfego por padrão. O plugin só é aplicado
 * quando `CLINICALSTUDYPB_E2E=1` (ver `app.config.js`); os demais builds não mudam.
 */
module.exports = function withE2eCleartextTraffic(config) {
  return withAndroidManifest(config, (modConfig) => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:usesCleartextTraffic'] = 'true';
    }
    return modConfig;
  });
};
