import { mkdir, rm } from "node:fs/promises";
import solidPlugin from "@opentui/solid/bun-plugin";

const targets = {
  "darwin-arm64": "bun-darwin-arm64",
  "darwin-x64": "bun-darwin-x64",
  "linux-arm64": "bun-linux-arm64",
  "linux-x64": "bun-linux-x64",
  "windows-x64": "bun-windows-x64",
} as const;
type HostTarget = keyof typeof targets;
const isHostTarget = (value: string): value is HostTarget => Object.hasOwn(targets, value);

const os = process.platform === "win32" ? "windows" : process.platform;
const host = `${os}-${process.arch}`;
if (!isHostTarget(host)) throw new Error(`Unsupported build host: ${host}`);
const target = targets[host];
const outfile = `dist/reviewbench${process.platform === "win32" ? ".exe" : ""}`;

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
const result = await Bun.build({
  entrypoints: ["src/index.tsx"],
  target: "bun",
  plugins: [solidPlugin],
  compile: {
    target,
    outfile,
    autoloadBunfig: false,
    autoloadDotenv: false,
  },
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
