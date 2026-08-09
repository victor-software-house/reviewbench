import { describe, expect, test } from "bun:test";
import { packageIdentity } from "./index";

describe("session-core package", () => {
  test("exposes its stable workspace identity", () => {
    expect(packageIdentity).toBe("session-core");
  });
});
