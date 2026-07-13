export function waitForSelector(
  selector: string,
  timeoutMs = 2000,
  intervalMs = 100
): Promise<Element> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      return reject(new Error("waitForSelector called server-side"));
    }
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const start = Date.now();
    const interval = window.setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        window.clearInterval(interval);
        resolve(el);
      } else if (Date.now() - start > timeoutMs) {
        window.clearInterval(interval);
        reject(new Error(`Timeout waiting for ${selector}`));
      }
    }, intervalMs);
  });
}
