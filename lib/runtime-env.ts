export type RuntimeEnv = Record<string, never>;

export function getRuntimeEnv(): RuntimeEnv {
  return {};
}
