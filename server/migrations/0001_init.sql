CREATE TABLE guests (guest_id TEXT PRIMARY KEY, nickname TEXT NOT NULL, color INTEGER NOT NULL, created_at REAL NOT NULL, last_seen REAL NOT NULL);
CREATE TABLE store_occupancy (store_no INTEGER PRIMARY KEY, count INTEGER NOT NULL, updated_at REAL NOT NULL);
