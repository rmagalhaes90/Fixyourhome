const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../app/lib")];
config.resolver.sourceExts = Array.from(new Set([...(config.resolver.sourceExts ?? []), "mjs"]));

module.exports = config;
