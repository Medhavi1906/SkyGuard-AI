import { describe, expect, it } from "vitest";
import { isUsableRealtimeResponse } from "./realtime";

describe("isUsableRealtimeResponse", () => {
  it("accepts a successful JSON response", () => {
    expect(isUsableRealtimeResponse(new Response('{"source":"replay"}', { status: 200, headers: { "content-type": "application/json" } }))).toBe(true);
  });

  it("rejects the HTML SPA fallback returned for a missing API route", () => {
    expect(isUsableRealtimeResponse(new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } }))).toBe(false);
  });

  it("rejects failed JSON responses", () => {
    expect(isUsableRealtimeResponse(new Response('{"error":"unavailable"}', { status: 502, headers: { "content-type": "application/json" } }))).toBe(false);
  });
});
