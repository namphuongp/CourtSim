import 'dotenv/config';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { startPaymentPolling } from './services/paymentPolling.js';
import { gatewayConfig, paymentProvider } from './services/sepayGateway.js';

const app = createApp();
let server;
let stopPaymentPolling;

async function start() {
  // Chỉ nhận request sau khi MongoDB sẵn sàng.
  await connectDatabase();
  try {
    if (paymentProvider() === 'sepay_gateway') {
      const config = gatewayConfig();
      console.info(`Đã nạp cấu hình SePay (${config.environment}), xác nhận thanh toán bằng polling.`);
    }
  } catch (error) {
    console.error('Cần kiểm tra cấu hình thanh toán trong backend/.env:', { code: error.code ?? 'PAYMENT_CONFIG_INVALID' });
  }
  stopPaymentPolling = startPaymentPolling();
  server = app.listen(env.PORT, process.env.HOST || '0.0.0.0', () => console.info('CourtSim API đã sẵn sàng.'));
}

async function shutdown(signal) {
  console.log(`Nhận ${signal}, đang dừng server...`);
  if (stopPaymentPolling) await stopPaymentPolling();
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
