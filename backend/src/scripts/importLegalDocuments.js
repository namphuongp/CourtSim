import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { importLegalDocument } from '../services/legalImportService.js';

function parseArguments(argumentsList) {
  let lawNumber = '';
  const filePaths = [];

  for (let index = 0; index < argumentsList.length; index += 1) {
    if (argumentsList[index] === '--law') {
      lawNumber = argumentsList[index + 1] ?? '';
      index += 1;
    } else if (argumentsList[index] === '--file') {
      const filePath = argumentsList[index + 1];
      if (!filePath) throw new Error('Thiếu đường dẫn sau --file.');
      filePaths.push(filePath);
      index += 1;
    } else {
      throw new Error(`Tham số không hợp lệ: ${argumentsList[index]}`);
    }
  }

  if (!lawNumber || !filePaths.length) {
    throw new Error('Cách dùng: npm run legal:import -- --law <số-hiệu> --file <đường-dẫn> [--file <đường-dẫn> ...]');
  }
  return { lawNumber, filePaths };
}

async function run() {
  const input = parseArguments(process.argv.slice(2));
  await connectDatabase();
  const result = await importLegalDocument(input);
  console.log(JSON.stringify(result, null, 2));
}

run()
  .catch((error) => {
    console.error(`Nhập văn bản pháp luật thất bại: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(disconnectDatabase);
