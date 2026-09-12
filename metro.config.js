// Firebase JS SDK + Expo SDK 53+ : package exports 해석을 끄지 않으면 "Component auth has not been registered" 오류가 남
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = false;
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs'];
module.exports = config;
