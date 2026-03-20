interface KVNamespace {
  get(
    key: string,
    options?: { type?: "text" | "json" | "arrayBuffer" | "stream" }
  ): Promise<any>;
  put(
    key: string,
    value: string,
    options?: Record<string, unknown>
  ): Promise<void>;
}
