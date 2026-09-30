// 本机无法安装 @types/node，这里提供测试用到的最小声明。
declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  interface Assert {
    (value: unknown, message?: string): asserts value;
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    throws(fn: () => unknown, pattern?: RegExp, message?: string): void;
  }
  const assert: Assert;
  export default assert;
}
