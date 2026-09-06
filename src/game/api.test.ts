import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getBoard, request } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("online request failures", () => {
  it.each([
    [401, "text/html", "<h1>Sign in</h1>"],
    [503, "text/html", "<h1>Unavailable</h1>"],
    [409, "application/json", "{broken"],
    [400, "application/json", "null"],
    [429, "application/json", '{"error":{"message":"wrong shape"}}'],
    [502, "application/json", '{"error":"  "}'],
  ])(
    "preserves HTTP %s when the error body cannot be used",
    async (status, type, body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(body, {
            status,
            headers: { "Content-Type": type },
          }),
        ),
      );
      const error = await request("/api/session").catch(
        (error: unknown) => error,
      );
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status, name: "ApiError" });
      expect((error as Error).message).toContain(
        "online service is unavailable",
      );
      expect((error as Error).message).not.toContain(body);
    },
  );

  it("retains the server's actionable error message and status", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: "This ticket has already been submitted." },
            { status: 409 },
          ),
        ),
    );
    await expect(request("/api/scores", {})).rejects.toMatchObject({
      message: "This ticket has already been submitted.",
      status: 409,
    });
  });

  it.each([
    ["text/html", "<html>App fallback</html>"],
    ["application/json", "{broken"],
  ])(
    "treats a malformed successful %s response as unavailable",
    async (type, body) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(body, {
            headers: { "Content-Type": type },
          }),
        ),
      );
      await expect(request("/api/session")).rejects.toThrow(
        "online service is unavailable",
      );
    },
  );

  it("returns valid JSON without changing its shape", async () => {
    const data = { profile: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data)));
    await expect(request("/api/session")).resolves.toEqual(data);
  });
});

describe("request cancellation", () => {
  function pendingFetch() {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_path: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init.signal!;
            if (signal.aborted) reject(signal.reason);
            else
              signal.addEventListener("abort", () => reject(signal.reason), {
                once: true,
              });
          }),
      ),
    );
  }

  it("preserves caller cancellation of a leaderboard request", async () => {
    pendingFetch();
    const controller = new AbortController();
    const result = getBoard("2026-09-05", "world", null, controller.signal);
    controller.abort();
    await expect(result).rejects.toBe(controller.signal.reason);
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });

  it("keeps the request deadline when the caller supplies a signal", async () => {
    pendingFetch();
    const deadline = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(deadline.signal);
    const caller = new AbortController();
    const result = getBoard("2026-09-05", "world", null, caller.signal);
    deadline.abort(new DOMException("Time limit", "TimeoutError"));
    await expect(result).rejects.toThrow("online request timed out");
    expect(caller.signal.aborted).toBe(false);
    expect(timeout).toHaveBeenCalledExactlyOnceWith(12000);
  });

  it("preserves cancellation while reading a failed response body", async () => {
    const controller = new AbortController();
    const response = Response.json({}, { status: 401 });
    vi.spyOn(response, "json").mockImplementation(async () => {
      controller.abort();
      throw controller.signal.reason;
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(
      request("/api/session", undefined, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
