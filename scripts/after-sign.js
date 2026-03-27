const { notarize } = require("@electron/notarize");

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath =
    context.appOutDir && context.packager ? `${context.appOutDir}/${context.packager.appInfo.productFilename}.app` : null;
  if (!appPath) return;

  const appleApiKey = process.env.APPLE_API_KEY;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;

  // Local/dev builds can skip notarization; release CI should provide all secrets.
  if (!appleApiKey || !appleApiKeyId || !appleApiIssuer) {
    // eslint-disable-next-line no-console
    console.warn("Skipping notarization (APPLE_API_KEY / APPLE_API_KEY_ID / APPLE_API_ISSUER not set).");
    return;
  }

  await notarize({
    appPath,
    appleApiKey,
    appleApiKeyId,
    appleApiIssuer
  });
};
