-- 4단계(설계 2026-10-31 인형 채우기 §4.6): 가방에 캐릭터·색·희귀 단계를 함께 남긴다 — 도감이 "색 n/6 · 희귀 n/8 · 황금"을 센다.
-- 옛 행은 색 0·일반으로 옮기고, 옛 희귀 캐릭터 4종은 그 캐릭터의 희귀판으로 (shared/catalog.json의 legacy와 같다). 겹치면 합친다.
CREATE TABLE bag_v3 (
  guest_id TEXT NOT NULL, doll TEXT NOT NULL, color INTEGER NOT NULL, rare TEXT NOT NULL, zone TEXT NOT NULL,
  count INTEGER NOT NULL, first_at REAL NOT NULL,
  PRIMARY KEY (guest_id, doll, color, rare, zone)
);
INSERT INTO bag_v3 (guest_id, doll, color, rare, zone, count, first_at)
SELECT guest_id,
  CASE doll WHEN 'starbunny' THEN 'bunny' WHEN 'pearlpenguin' THEN 'penguin' WHEN 'rainbowdino' THEN 'dino' WHEN 'goldfox' THEN 'fox' ELSE doll END,
  0,
  CASE doll WHEN 'starbunny' THEN 'star' WHEN 'pearlpenguin' THEN 'pearl' WHEN 'rainbowdino' THEN 'rainbow' WHEN 'goldfox' THEN 'gold' ELSE '' END,
  zone, SUM(count), MIN(first_at)
FROM bag GROUP BY 1, 2, 4, 5;
DROP TABLE bag;
ALTER TABLE bag_v3 RENAME TO bag;
