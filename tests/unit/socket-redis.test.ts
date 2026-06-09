import { describe, expect, it, vi } from "vitest";
import { configureSocketRedis } from "@/server/socket-redis";

describe("configureSocketRedis", () => {
  it("keeps the in-memory adapter when REDIS_URL is absent", async () => {
    const io = { adapter: vi.fn() };
    const createClient = vi.fn();

    const connection = await configureSocketRedis(io, undefined, { createClient, createAdapter: vi.fn() });

    expect(connection.enabled).toBe(false);
    expect(createClient).not.toHaveBeenCalled();
    expect(io.adapter).not.toHaveBeenCalled();
  });

  it("connects publisher/subscriber clients and installs the Redis adapter", async () => {
    const subscriber = {
      connect: vi.fn(),
      quit: vi.fn(),
      duplicate: vi.fn()
    };
    const publisher = {
      connect: vi.fn(),
      quit: vi.fn(),
      duplicate: vi.fn(() => subscriber)
    };
    const adapter = Symbol("adapter");
    const io = { adapter: vi.fn() };
    const createClient = vi.fn(() => publisher);
    const createAdapter = vi.fn(() => adapter);

    const connection = await configureSocketRedis(io, "redis://redis:6379", {
      createClient,
      createAdapter
    });

    expect(createClient).toHaveBeenCalledWith({ url: "redis://redis:6379" });
    expect(publisher.connect).toHaveBeenCalled();
    expect(subscriber.connect).toHaveBeenCalled();
    expect(createAdapter).toHaveBeenCalledWith(publisher, subscriber);
    expect(io.adapter).toHaveBeenCalledWith(adapter);

    await connection.close();
    expect(publisher.quit).toHaveBeenCalled();
    expect(subscriber.quit).toHaveBeenCalled();
  });

  it("falls back to the in-memory adapter when Redis is unavailable", async () => {
    const subscriber = {
      connect: vi.fn().mockRejectedValue(new Error("redis unavailable")),
      quit: vi.fn(),
      duplicate: vi.fn()
    };
    const publisher = {
      connect: vi.fn(),
      quit: vi.fn(),
      duplicate: vi.fn(() => subscriber)
    };
    const io = { adapter: vi.fn() };

    const connection = await configureSocketRedis(io, "redis://redis:6379", {
      createClient: vi.fn(() => publisher),
      createAdapter: vi.fn()
    });

    expect(connection.enabled).toBe(false);
    expect(io.adapter).not.toHaveBeenCalled();
    expect(publisher.quit).toHaveBeenCalled();
    expect(subscriber.quit).toHaveBeenCalled();
  });
});
