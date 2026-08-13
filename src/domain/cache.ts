export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  disconnect(): Promise<void>;
}

export function weatherCacheKey(location: string): string {
  return `weather:v1:${encodeURIComponent(location.trim().toLocaleLowerCase('en-US'))}`;
}
