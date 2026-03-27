const { spawnSync } = require("child_process");

exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = context.appOutDir && context.packager ? `${context.appOutDir}/${context.packager.appInfo.productFilename}.app` : null;
  if (!appPath) return;

  // Use ad-hoc deep signing so Gatekeeper sees a consistent bundle when no Developer ID cert is configured.
  const res = spawnSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit"
  });
  if (res.status !== 0) {
    throw new Error("codesign failed in afterSign hook.");
  }
};
