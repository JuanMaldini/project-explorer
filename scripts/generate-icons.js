/* eslint-disable no-console */

const fs = require("fs/promises");
const path = require("path");

const { Resvg } = require("@resvg/resvg-js");
const pngToIco = require("png-to-ico");

const projectRoot = path.join(__dirname, "..");

const SRC_SVG = path.join(projectRoot, "public", "icons", "Logo.svg");

const OUT_PUBLIC_DIR = path.join(projectRoot, "public", "icons");
const OUT_BUILD_DIR = path.join(projectRoot, "build", "icons");
const OUT_ELECTRON_ASSETS_DIR = path.join(projectRoot, "electron", "assets");

const renderSvgToPng = (svgBuffer, size) => {
  const resvg = new Resvg(svgBuffer, {
    fitTo: {
      mode: "width",
      value: size,
    },
  });

  const pngData = resvg.render();
  return pngData.asPng();
};

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
};

const writeFileIfChanged = async (filePath, data) => {
  try {
    const existing = await fs.readFile(filePath);
    if (Buffer.compare(existing, data) === 0) return false;
  } catch {
    // ignore
  }

  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, data);
  return true;
};

const main = async () => {
  const svg = await fs.readFile(SRC_SVG);

  await ensureDir(OUT_PUBLIC_DIR);
  await ensureDir(OUT_BUILD_DIR);
  await ensureDir(OUT_ELECTRON_ASSETS_DIR);

  // Window/titlebar icon (PNG)
  const png256 = renderSvgToPng(svg, 256);
  const png512 = renderSvgToPng(svg, 512);

  const wrotePublicPng = await writeFileIfChanged(
    path.join(OUT_PUBLIC_DIR, "app.png"),
    png256,
  );
  const wroteBuildPng = await writeFileIfChanged(
    path.join(OUT_BUILD_DIR, "app.png"),
    png512,
  );
  const wroteElectronPng = await writeFileIfChanged(
    path.join(OUT_ELECTRON_ASSETS_DIR, "app.png"),
    png512,
  );

  // Windows executable icon (ICO)
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoPngs = icoSizes.map((s) => renderSvgToPng(svg, s));
  const ico = await pngToIco(icoPngs);

  const wroteIco = await writeFileIfChanged(
    path.join(OUT_BUILD_DIR, "icon.ico"),
    ico,
  );
  const wroteElectronIco = await writeFileIfChanged(
    path.join(OUT_ELECTRON_ASSETS_DIR, "icon.ico"),
    ico,
  );

  const suffix = (updated) => (updated ? " (updated)" : "");

  console.log(
    `[icons] src=${path.relative(projectRoot, SRC_SVG)} -> ` +
      `public/icons/app.png${suffix(wrotePublicPng)}, ` +
      `build/icons/app.png${suffix(wroteBuildPng)}, ` +
      `build/icons/icon.ico${suffix(wroteIco)}, ` +
      `electron/assets/app.png${suffix(wroteElectronPng)}, ` +
      `electron/assets/icon.ico${suffix(wroteElectronIco)}`,
  );
};

main().catch((err) => {
  console.error("[icons] failed:", err);
  process.exitCode = 1;
});
