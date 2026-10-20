export function createCareerProfileSaveQueue() {
  let tail: Promise<void> = Promise.resolve();

  return function enqueue<T>(save: () => Promise<T>): Promise<T> {
    const result = tail.then(save, save);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}
