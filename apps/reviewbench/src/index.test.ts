import { describe, expect, test } from "bun:test";
import { packageIdentity } from "./index";

describe("app package", () => {
  test("exposes its stable workspace identity", () => {
    expect(packageIdentity).toBe("app");
  });
});
