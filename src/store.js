import fs from 'node:fs';
import path from 'node:path';

const DB_PATH = path.resolve('data/db.json');

const DEFAULT_DB = {
  users: [],
  trades: []
};

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
  }
}

export function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

export function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

export function updateDb(mutator) {
  const db = readDb();
  mutator(db);
  writeDb(db);
  return db;
}
