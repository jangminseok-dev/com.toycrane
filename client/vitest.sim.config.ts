import { defineConfig } from 'vitest/config';

// 물리 시뮬레이션(확률 맞추기·장면 재현) — 느려서 보통 테스트와 따로 돌린다: npm run sim (SIM_TRIALS로 횟수 조절)
export default defineConfig({
  test: { include: ['sim/**/*.test.ts'], testTimeout: 1_800_000, hookTimeout: 120_000 },
});
