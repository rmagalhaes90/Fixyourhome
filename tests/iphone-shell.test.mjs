import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = JSON.parse(readFileSync(new URL("../mobile/app.json", import.meta.url), "utf8"));
const shell = readFileSync(new URL("../mobile/App.js", import.meta.url), "utf8");
const htmlModule = readFileSync(new URL("../mobile/html.js", import.meta.url), "utf8");

test("the iPhone app is a private on-device shell", () => {
  assert.equal(app.expo.ios.bundleIdentifier, "com.tidynext.home");
  assert.match(app.expo.plugins[0][1].cameraPermission, /iPhone/);
  assert.match(shell, /react-native-webview/);
  assert.match(shell, /baseUrl: "https:\/\/tidynext\.local"/);
  assert.match(shell, /TidyNextNative/);
  assert.doesNotMatch(shell, /trycloudflare|ngrok|localhost:\d+/);
});

test("the installed screen is one HTML file with the on-phone plan", () => {
  assert.match(htmlModule, /^export const appHtml = "/);
  const html = JSON.parse(htmlModule.slice(htmlModule.indexOf("=") + 1).trim().replace(/;$/, ""));
  assert.match(html, /<style>/);
  assert.match(html, /<script type="module">/);
  assert.equal(html.toLowerCase().split("</script>").length, 2);
  assert.match(html, /Criar meu plano/);
  assert.match(html, /O plano fica neste iPhone/);
  assert.doesNotMatch(html, /trycloudflare|ngrok/);
});
