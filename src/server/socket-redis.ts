import type { Server as IOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

type RedisClient = {
  connect(): Promise<unknown>;
  duplicate(): RedisClient;
  quit(): Promise<unknown>;
};

type SocketServer = Pick<IOServer, "adapter">;

type SocketRedisDependencies = {
  createClient(input: { url: string }): RedisClient;
  createAdapter(publisher: RedisClient, subscriber: RedisClient): unknown;
};

const defaultDependencies: SocketRedisDependencies = {
  createClient,
  createAdapter
};

export async function configureSocketRedis(
  io: SocketServer,
  redisUrl = process.env.REDIS_URL,
  dependencies: SocketRedisDependencies = defaultDependencies
) {
  if (!redisUrl) {
    return { enabled: false, close: async () => undefined };
  }

  const publisher = dependencies.createClient({ url: redisUrl });
  const subscriber = publisher.duplicate();
  try {
    await Promise.all([publisher.connect(), subscriber.connect()]);
  } catch (error) {
    await Promise.allSettled([publisher.quit(), subscriber.quit()]);
    return {
      enabled: false,
      error,
      close: async () => undefined
    };
  }
  io.adapter(dependencies.createAdapter(publisher, subscriber) as ReturnType<typeof createAdapter>);

  return {
    enabled: true,
    async close() {
      await Promise.all([publisher.quit(), subscriber.quit()]);
    }
  };
}
