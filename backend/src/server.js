import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';

const app = createApp();
let server;

async function start() {
  // Chỉ nhận request sau khi MongoDB sẵn sàng.
  await connectDatabase();
  server = app.listen(env.PORT, process.env.HOST || '127.0.0.1', () => console.info('CourtSim API đã sẵn sàng.'));
}

async function shutdown(signal) {
  console.log(`Nhận ${signal}, đang dừng server...`);
  if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await disconnectDatabase();
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal).catch((error) => {
    console.error('Không thể dừng server an toàn:', { name: error.name });
    process.exit(1);
  }));
}

start().catch((error) => {
  console.error('Không thể khởi động CourtSim API:', { name: error.name });
  process.exit(1);
});
