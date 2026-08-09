import { describe, expect, test } from "bun:test";
import { packageIdentity } from "./index";

describe("diff-engine package", () => {
  test("exposes its stable workspace identity", () => {
    expect(packageIdentity).toBe("diff-engine");
  });
});
