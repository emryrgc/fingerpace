import { openDb } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || 'data/fingermcqueen.db';

const app = createApp(openDb(DB_FILE));
app.listen(PORT, () => console.log(`🏁 FingerMcQueen pistte: http://localhost:${PORT}`));
