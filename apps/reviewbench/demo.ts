import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import dedent from "dedent";

const binary = join(import.meta.dir, "dist", "reviewbench");

function git(cwd: string, args: string[]) {
  const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error(`git ${args[0] ?? "command"} failed`);
}

async function createDemoProject() {
  const identity = typeof process.getuid === "function" ? process.getuid() : process.pid;
  const root = join(tmpdir(), `reviewbench-demo-${identity}`);
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });

  await Bun.write(
    join(root, "pricing.ts"),
    `${dedent`
      export interface Quote {
        subtotal: number;
        total: number;
        label: string;
      }

      const SERVICE_RATE = 0.05;
      const PRIORITY_THRESHOLD = 150;

      function serviceFee(subtotal: number) {
        return subtotal * SERVICE_RATE;
      }

      function roundMoney(amount: number) {
        return Math.round(amount * 100) / 100;
      }

      function formatCurrency(amount: number) {
        return '$' + amount.toFixed(2);
      }

      function regionalAdjustment(subtotal: number) {
        return subtotal > PRIORITY_THRESHOLD ? 3 : 0;
      }

      export function quote(subtotal: number): Quote {
        return {
          subtotal,
          total: subtotal + serviceFee(subtotal) + regionalAdjustment(subtotal),
          label: 'Standard delivery',
        };
      }
    `}\n`,
  );
  await Bun.write(
    join(root, "settings.json"),
    `${dedent`
      {
        "currency": "USD",
        "locale": "en-US",
        "taxInclusive": false
      }
    `}\n`,
  );
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["add", "."]);
  git(root, [
    "-c",
    "user.name=Reviewbench Demo",
    "-c",
    "user.email=demo@reviewbench.local",
    "commit",
    "-qm",
    "baseline",
  ]);

  await Bun.write(
    join(root, "pricing.ts"),
    `${dedent`
      export interface Quote {
        subtotal: number;
        total: number;
        label: string;
      }

      const SERVICE_RATE = 0.075;
      const PRIORITY_THRESHOLD = 100;

      function serviceFee(subtotal: number) {
        return subtotal * SERVICE_RATE;
      }

      function roundMoney(amount: number) {
        return Math.round(amount * 100) / 100;
      }

      function formatCurrency(amount: number) {
        return '$' + amount.toFixed(2);
      }

      function regionalAdjustment(subtotal: number) {
        return subtotal > PRIORITY_THRESHOLD ? 3 : 0;
      }

      export function quote(subtotal: number): Quote {
        const total = subtotal + serviceFee(subtotal) + regionalAdjustment(subtotal);
        return {
          subtotal,
          total,
          label: 'Priority delivery — 東京',
        };
      }
    `}\n`,
  );
  await Bun.write(
    join(root, "settings.json"),
    `${dedent`
      {
        "currency": "JPY",
        "locale": "ja-JP",
        "taxInclusive": true
      }
    `}\n`,
  );
  await Bun.write(
    join(root, "review-notes.md"),
    "# Review focus\n\nConfirm the regional threshold and localized receipt label.\n",
  );
  return root;
}

const suppliedProject = process.argv[2];
const project = suppliedProject ? resolve(suppliedProject) : await createDemoProject();
const port = String(50_000 + (process.pid % 10_000));
if (!process.execve) throw new Error("This Bun runtime cannot hand the terminal to Reviewbench.");

process.execve(binary, [binary, project], { ...process.env, HUNK_MCP_PORT: port });
