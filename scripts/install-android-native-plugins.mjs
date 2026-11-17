import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const androidRoot = path.join(root, "android");
const sourcePlugin = path.join(root, "native", "android", "OscUdpPlugin.java");
const manifestPath = path.join(androidRoot, "app", "src", "main", "AndroidManifest.xml");
const javaRoot = path.join(androidRoot, "app", "src", "main", "java");

function findMainActivity(directory) {
  if (!fs.existsSync(directory)) return null;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = findMainActivity(fullPath);
      if (found) return found;
    } else if (entry.isFile() && entry.name === "MainActivity.java") {
      return fullPath;
    }
  }
  return null;
}

if (!fs.existsSync(androidRoot) || !fs.existsSync(sourcePlugin) || !fs.existsSync(manifestPath)) {
  throw new Error("Android project not found. Run 'npx cap add android' before installing the native OSC plugin.");
}

const mainActivityPath = findMainActivity(javaRoot);
if (!mainActivityPath) throw new Error("MainActivity.java was not found in the generated Android project.");

let mainActivity = fs.readFileSync(mainActivityPath, "utf8");
const packageMatch = mainActivity.match(/^\s*package\s+([a-zA-Z0-9_.]+)\s*;/m);
if (!packageMatch) throw new Error("Could not determine Android application package from MainActivity.java.");
const packageName = packageMatch[1];

const pluginSource = fs.readFileSync(sourcePlugin, "utf8").replace("__APP_PACKAGE__", packageName);
const pluginPath = path.join(path.dirname(mainActivityPath), "OscUdpPlugin.java");
fs.writeFileSync(pluginPath, pluginSource, "utf8");

if (!mainActivity.includes("import android.os.Bundle;")) {
  mainActivity = mainActivity.replace(/^(package\s+[a-zA-Z0-9_.]+;\s*)/m, "$1\nimport android.os.Bundle;");
}
const pluginImport = `import ${packageName}.OscUdpPlugin;`;
if (!mainActivity.includes(pluginImport)) {
  mainActivity = mainActivity.replace(/^(package\s+[a-zA-Z0-9_.]+;\s*)/m, "$1\n" + pluginImport);
}

if (!mainActivity.includes("registerPlugin(OscUdpPlugin.class)")) {
  if (/super\.onCreate\(savedInstanceState\);/.test(mainActivity)) {
    mainActivity = mainActivity.replace(
      /super\.onCreate\(savedInstanceState\);/,
      "registerPlugin(OscUdpPlugin.class);\n        super.onCreate(savedInstanceState);"
    );
  } else {
    const classOpen = /(public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{)/;
    if (!classOpen.test(mainActivity)) throw new Error("Unsupported MainActivity layout; refusing to rewrite it automatically.");
    mainActivity = mainActivity.replace(classOpen, `$1\n    @Override\n    public void onCreate(Bundle savedInstanceState) {\n        registerPlugin(OscUdpPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n`);
  }
}
fs.writeFileSync(mainActivityPath, mainActivity, "utf8");

let manifest = fs.readFileSync(manifestPath, "utf8");
const manifestStart = manifest.indexOf("<manifest");
const rootEnd = manifest.indexOf(">", manifestStart);
if (manifestStart < 0 || rootEnd < 0) throw new Error("AndroidManifest.xml has no manifest root element.");
if (!manifest.includes('android.permission.INTERNET')) {
  manifest = manifest.slice(0, rootEnd + 1) + '\n    <uses-permission android:name="android.permission.INTERNET" />' + manifest.slice(rootEnd + 1);
}
fs.writeFileSync(manifestPath, manifest, "utf8");
console.log(`Installed OscUdpPlugin in ${packageName} (read-only OSC queries only).`);
