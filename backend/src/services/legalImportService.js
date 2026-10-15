import { createHash } from 'node:crypto';
const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

export function getSourceFingerprint(sourceFiles) {
  const stableFiles = [...sourceFiles]
    .sort((left, right) => collator.compare(left.name, right.name))
    .map(({ sha256 }) => sha256)
    .sort();
  return createHash('sha256').update(JSON.stringify(stableFiles)).digest('hex');
}

export async function importLegalDocument() {
  throw new Error('Dùng npm run legal:inventory -- --reviews <manifest> [--apply] để kiểm tra nguồn và quyền trước khi nhập.');
}
