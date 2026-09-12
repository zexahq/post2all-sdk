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
  ]) {
    assert.match(stdout, new RegExp(`\\b${command}\\b`));
  }
});
