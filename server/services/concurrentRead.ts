// Share only reads that are currently running. Finished values are never cached.
// Keep user-owned rows and writes outside this helper.
export function coalesceConcurrentRead<K, V>(load: (key: K) => Promise<V>) {
  const pending = new Map<K, Promise<V>>();
  return (key: K): Promise<V> => {
    const existing = pending.get(key);
    if (existing) return existing;
    const result = Promise.resolve().then(() => load(key));
    pending.set(key, result);
    const clear = () => {
      if (pending.get(key) === result) pending.delete(key);
    };
    result.then(clear, clear);
    return result;
  };
}
