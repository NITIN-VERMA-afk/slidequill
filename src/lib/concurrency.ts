export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await task(items[index], index);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker()
  );

  await Promise.all(workers);
  return results;
}
