-- 5단계(설계 2026-10-31 교환소 개편 §4.2): 교환소 조르기를 마지막으로 받은 시각 — 게스트마다 10분에 한 번
ALTER TABLE wallets ADD COLUMN begged_at REAL;
