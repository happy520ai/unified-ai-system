export type PrimedGatewayStream<T> = Readonly<{
  iterator: AsyncIterator<T>;
  first: IteratorResult<T>;
}>;

type GatewayStreamErrorEvent = {
  type: "error";
  envelope?: {
    error?: Record<string, any>;
    [key: string]: any;
  } | Record<string, any>;
  [key: string]: any;
};

export async function primeGatewayStream<T>(stream: AsyncIterable<T>): Promise<PrimedGatewayStream<T>> {
  const iterator = stream[Symbol.asyncIterator]();
  let first: IteratorResult<T>;
  try {
    first = await iterator.next();
  } catch (error) {
    // Preserve the historical SSE error contract for iterators that throw
    // before their first yield. Protocol routes may still promote known
    // provider-dispatch errors to an HTTP response before committing headers.
    first = {
      done: false,
      value: { type: "error", envelope: { error } } as T,
    };
  }
  return Object.freeze({ iterator, first });
}

export async function* iteratePrimedGatewayStream<T>(primed: PrimedGatewayStream<T>): AsyncGenerator<T> {
  if (!primed.first.done) yield primed.first.value;
  while (true) {
    const next = await primed.iterator.next();
    if (next.done) return;
    yield next.value;
  }
}

export function readPrimedGatewayStreamError<T>(primed: PrimedGatewayStream<T>): Record<string, any> | null {
  if (primed?.first?.done) return null;
  const event = primed.first.value as GatewayStreamErrorEvent;
  if (event?.type !== "error") return null;
  return event.envelope?.error ?? event.envelope ?? event;
}

export async function closePrimedGatewayStream<T>(primed: PrimedGatewayStream<T>): Promise<void> {
  await primed?.iterator?.return?.();
}
