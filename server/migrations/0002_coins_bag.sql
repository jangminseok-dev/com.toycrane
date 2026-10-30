CREATE TABLE wallets (guest_id TEXT PRIMARY KEY, coins INTEGER NOT NULL, updated_at REAL NOT NULL);
CREATE TABLE bag (guest_id TEXT NOT NULL, doll TEXT NOT NULL, zone TEXT NOT NULL, count INTEGER NOT NULL, first_at REAL NOT NULL, PRIMARY KEY (guest_id, doll, zone));
