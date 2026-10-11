import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = JSON.parse(readFileSync(new URL("../mobile/app.json", import.meta.url), "utf8"));
const shell = readFileSync(new URL("../mobile/App.js", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../mobile/package.json", import.meta.url), "utf8"));

test("the iPhone app opens as a native screen on this phone", () => {
  assert.equal(app.expo.ios.bundleIdentifier, "com.tidynext.home");
  const scene = app.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-build-properties");
  const camera = app.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === "expo-image-picker");
  assert.equal(scene[1].ios.enableSceneSupport, true);
  const installer = readFileSync(new URL("../mobile/install-iphone.sh", import.meta.url), "utf8");
  assert.match(installer, /EXExpoAppSceneDelegate/);
  assert.match(installer, /buildConfiguration = "Release"/);
  assert.match(camera[1].cameraPermission, /iPhone/);
  assert.match(shell, /Criar meu plano/);
  assert.match(shell, /O plano fica neste iPhone/);
  assert.match(shell, /buildPlan/);
  assert.doesNotMatch(shell, /react-native-webview|appHtml|WebView/);
  assert.equal(pkg.dependencies["react-native-webview"], undefined);
  assert.doesNotMatch(shell, /trycloudflare|ngrok|localhost:\d+/);
});
