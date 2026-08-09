import { describe, expect, test } from "bun:test";
import { packageIdentity } from "./index";

describe("review-protocol package", () => {
  test("exposes its stable workspace identity", () => {
    expect(packageIdentity).toBe("review-protocol");
  });
});
