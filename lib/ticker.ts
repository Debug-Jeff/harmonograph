type Tick = (now: number) => void;

const subscribers = new Set<Tick>();
let raf = 0;

const loop = (now: number) => {
  subscribers.forEach((fn) => fn(now));
  raf = subscribers.size ? requestAnimationFrame(loop) : 0;
};

export function subscribe(fn: Tick): () => void {
  subscribers.add(fn);
  if (!raf) raf = requestAnimationFrame(loop);
  return () => {
    subscribers.delete(fn);
  };
}
