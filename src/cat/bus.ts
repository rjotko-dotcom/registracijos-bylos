// Minimal event bus so pages can trigger cat animations (e.g. feeding)
// without prop drilling.

type Handler = () => void;

const handlers = new Map<string, Set<Handler>>();

export const catBus = {
  on(event: 'fed', fn: Handler): () => void {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(fn);
    return () => handlers.get(event)?.delete(fn);
  },
  emit(event: 'fed') {
    handlers.get(event)?.forEach((fn) => fn());
  },
};
