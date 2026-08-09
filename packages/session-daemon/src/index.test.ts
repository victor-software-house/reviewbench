import { describe, expect, test } from "bun:test";
import { DEFAULT_SESSION_BROKER_HEALTH_PATH } from "./index";

describe("session-daemon package surface", () => {
  test("exports the Bun daemon health contract", () => {
    expect(DEFAULT_SESSION_BROKER_HEALTH_PATH).toBe("/health");
  });
});
