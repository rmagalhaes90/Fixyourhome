import { build } from "vite";
import react from "@vitejs/plugin-react";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const outDir = fileURLToPath(new URL("../mobile/web-dist/", import.meta.url));
const htmlModule = fileURLToPath(new URL("../mobile/html.js", import.meta.url));
const input = fileURLToPath(new URL("../mobile/web/index.html", import.meta.url));

function text(source) {
  return typeof source === "string" ? source : new TextDecoder().decode(source);
}

function singleFile() {
  return {
    name: "single-file",
    enforce: "post",
    generateBundle(_, bundle) {
      const htmlKey = Object.keys(bundle).find((name) => name.endsWith(".html"));
      if (!htmlKey) throw new Error("iPhone bundle did not emit HTML");
      const htmlFile = bundle[htmlKey];
      let html = text(htmlFile.source);
      const styles = [];
      const scripts = [];
      for (const [name, item] of Object.entries(bundle)) {
        if (item.type === "asset" && name.endsWith(".css")) styles.push(text(item.source));
        if (item.type === "chunk") scripts.push(item.code);
      }
      if (scripts.length !== 1) throw new Error(`Expected one script, got ${scripts.length}`);
      const code = scripts[0].replace(/<\/script/gi, "<\\/script");
      const style = `<style>${styles.join("\n")}</style>`;
      html = html.replace(/<link[^>]+rel="stylesheet"[^>]*>/g, () => style);
      html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>/g, "");
      html = html.replace(/<script type="module"[^>]*src="[^"]+"[^>]*><\/script>/, () => `<script type="module">${code}</script>`);
      for (const name of Object.keys(bundle)) {
        if (name !== htmlKey) delete bundle[name];
      }
      htmlFile.source = html;
    },
  };
}

mkdirSync(outDir, { recursive: true });
await build({
  root: projectRoot,
  configFile: false,
  publicDir: false,
  plugins: [react(), singleFile()],
  build: {
    outDir,
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    modulePreload: false,
    rollupOptions: {
      input,
      output: {
        codeSplitting: false,
      },
    },
  },
});

function findHtml(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      const nested = findHtml(path);
      if (nested) return nested;
    } else if (name.endsWith(".html")) return path;
  }
  return "";
}

const htmlPath = findHtml(outDir);
if (!htmlPath) throw new Error("iPhone bundle HTML was not written");
const html = readFileSync(htmlPath, "utf8");
if (!html.includes("<style>") || !html.includes("<script type=\"module\">")) {
  throw new Error("iPhone HTML is still split into extra files");
}
writeFileSync(htmlModule, `export const appHtml = ${JSON.stringify(html)};\n`);
rmSync(outDir, { recursive: true, force: true });
console.log(`Wrote ${htmlModule} (${html.length} bytes)`);
