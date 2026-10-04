/** Short, sortable-enough unique id. crypto.randomUUID is available in all supported runtimes. */
export function uid(): string {
  return crypto.randomUUID();
}
