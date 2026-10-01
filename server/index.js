import { openDb } from './db.js';
import { createApp } from './app.js';
import { attachRaces } from './race.js';

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || 'data/fingermcqueen.db';

const db = openDb(DB_FILE);
const server = createApp(db).listen(PORT, () => console.log(`🏁 FingerMcQueen pistte: http://localhost:${PORT}`));
attachRaces(server, db);
