export async function waitForCondition(
  check: () => Promise<boolean> | boolean,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 20000;
  const intervalMs = options?.intervalMs ?? 200;

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`waitForCondition timed out after ${timeoutMs}ms`);
}
