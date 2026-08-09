import { describe, expect, test } from "bun:test";
import { packageIdentity } from "./index";

describe("session-daemon package", () => {
  test("exposes its stable workspace identity", () => {
    expect(packageIdentity).toBe("session-daemon");
  });
});
