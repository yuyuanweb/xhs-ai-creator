import { defineConfig } from 'tsup';

// 双格式输出：前端走 ESM，NestJS 后端按 CommonJS 编译，同一份类型两边共用
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
});
