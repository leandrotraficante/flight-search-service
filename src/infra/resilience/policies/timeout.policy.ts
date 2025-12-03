import { TimeoutPolicy, TimeoutStrategy } from 'cockatiel';

export function createTimeoutPolicy(timeoutMs: number = 1000): TimeoutPolicy {
  return new TimeoutPolicy(timeoutMs, {
    strategy: TimeoutStrategy.Cooperative,
  });
}
