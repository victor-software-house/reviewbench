import { describe, expect, test } from "bun:test";
import { SESSION_BROKER_REGISTRATION_VERSION } from "./index";

describe("session-core package surface", () => {
  test("exports the broker registration contract", () => {
    expect(SESSION_BROKER_REGISTRATION_VERSION).toBe(2);
  });
});
