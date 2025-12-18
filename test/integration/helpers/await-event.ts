import { EventEmitter2 } from '@nestjs/event-emitter';

export async function awaitEvent<T = any>(
  emitter: EventEmitter2,
  eventName: string,
  options?: {
    timeoutMs?: number;
    filter?: (payload: T) => boolean;
  },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 5000;
  const filter = options?.filter;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(eventName, handler);
      reject(
        new Error(`awaitEvent timeout after ${timeoutMs}ms: ${eventName}`),
      );
    }, timeoutMs);

    const handler = (payload: T) => {
      if (filter && !filter(payload)) {
        return;
      }
      clearTimeout(timer);
      emitter.off(eventName, handler);
      resolve(payload);
    };

    emitter.on(eventName, handler);
  });
}
