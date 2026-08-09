import { describe, expect, test } from "bun:test";
import { packageIdentity } from "./index";

describe("test-kit package", () => {
  test("exposes its stable workspace identity", () => {
    expect(packageIdentity).toBe("test-kit");
  });
});
