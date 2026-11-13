import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.churchaudio.analyzer",
  appName: "Church Audio Analyzer",
  webDir: "dist",
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false
  }
};

export default config;
