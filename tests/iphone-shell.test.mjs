import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = JSON.parse(readFileSync(new URL("../mobile/app.json", import.meta.url), "utf8"));
const shell = readFileSync(new URL("../mobile/App.js", import.meta.url), "utf8");
const pkg = JSON.parse(readFileSync(new URL("../mobile/package.json", import.meta.url), "utf8"));

test("the iPhone app opens as a native screen on this phone", () => {
  assert.equal(app.expo.ios.bundleIdentifier, "com.tidynext.home");
  assert.match(app.expo.plugins[0][1].cameraPermission, /iPhone/);
  assert.match(shell, /Criar meu plano/);
  assert.match(shell, /O plano fica neste iPhone/);
  assert.match(shell, /buildPlan/);
  assert.doesNotMatch(shell, /react-native-webview|appHtml|WebView/);
  assert.equal(pkg.dependencies["react-native-webview"], undefined);
  assert.doesNotMatch(shell, /trycloudflare|ngrok|localhost:\d+/);
});
