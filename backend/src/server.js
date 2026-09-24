import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';

const app = createApp();
let server;

async function start() {
  // Chỉ nhận request sau khi MongoDB sẵn sàng.
  await connectDatabase();
  server = app.listen(env.PORT, () => console.log(`CourtSim API đang chạy tại http://localhost:${env.PORT}`));
}

async function shutdown(signal) {
  console.log(`Nhận ${signal}, đang dừng server...`);
  if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await disconnectDatabase();
  process.exit(0);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(signal).catch((error) => {
    console.error('Không thể dừng server an toàn:', error);
    process.exit(1);
  }));
}

start().catch((error) => {
  console.error('Không thể khởi động CourtSim API:', error.message);
  process.exit(1);
});
