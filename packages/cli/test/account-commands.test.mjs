import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("account help exposes the public account lifecycle commands", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["dist/index.js", "account", "--help"],
    {
      cwd: new URL("..", import.meta.url),
    },
  );

  for (const command of [
    "platforms",
    "get",
    "connect",
    "connection",
    "reconnect",
    "disconnect",
    "profile",
  ]) {
    assert.match(stdout, new RegExp(`\\b${command}\\b`));
  }
});

test("CLI exposes profile lifecycle commands and global profile scoping", async () => {
  const [{ stdout: rootHelp }, { stdout: profileHelp }] = await Promise.all([
    execFileAsync(process.execPath, ["dist/index.js", "--help"], {
      cwd: new URL("..", import.meta.url),
    }),
    execFileAsync(process.execPath, ["dist/index.js", "profile", "--help"], {
      cwd: new URL("..", import.meta.url),
    }),
  ]);

  assert.match(rootHelp, /--profile-id <profileId>/);
  for (const command of ["list", "get", "create", "update", "delete"]) {
    assert.match(profileHelp, new RegExp(`\\b${command}\\b`));
  }
});
