import 'dotenv/config';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('seed: fresh database and idempotent replay', {skip: !process.env.COURTSIM_TEST_MONGO_URI, timeout: 300000}, async () => {
  const cwd = fileURLToPath(new URL('../', import.meta.url));
  const dbName = 'courtsim_test_seed_' + randomUUID().replaceAll('-', '');
  const mongoUrl = new URL(process.env.COURTSIM_TEST_MONGO_URI);
  mongoUrl.pathname = '/' + dbName;
  const uri = mongoUrl.toString();
  try {
    await mongoose.connect(uri, {serverSelectionTimeoutMS: 5000});
    const env = { ...process.env, JWT_SECRET: randomUUID(), MONGO_URI: uri, SEED_ADMIN_EMAIL: 'seed-test@courtsim.local', SEED_ADMIN_PASSWORD: randomUUID() };
    function seed() {
      const r = spawnSync(process.execPath, ['src/scripts/seed.js'], { cwd, env, encoding: 'utf8', timeout: 120000 });
      console.log(r.stdout, r.stderr);
      assert.equal(r.status, 0);
    }
    seed();
    const db = mongoose.connection.db;
    const first = await db.collection('users').findOne({ email: env.SEED_ADMIN_EMAIL });
    assert.equal(first.email_verified, true);
    await db.collection('cases').updateOne({}, { $set: { summary: 'Preserve edited summary' } });
    env.SEED_ADMIN_PASSWORD = randomUUID();
    seed();
    const second = await db.collection('users').findOne({ email: env.SEED_ADMIN_EMAIL });
    assert.equal(first.password_hash, second.password_hash);
    assert.equal(await db.collection('cases').countDocuments({ summary: 'Preserve edited summary' }), 1);
    const manifest = JSON.parse(await readFile(new URL('../src/data/seed/manifest.json', import.meta.url), 'utf8'));
    for (const [name, entry] of Object.entries(manifest.collections)) assert.equal(await db.collection(name).countDocuments(), entry.count, name);
    for (const [child, parent] of [['legalprovisions', 'legaldocuments'], ['legalcorpusprovisions', 'legalcorpusversions']]) {
      const missing = await db.collection(child).aggregate([{ $lookup: { from: parent, localField: 'document_id', foreignField: '_id', as: 'parent' } }, { $match: { parent: { $size: 0 } } }, { $count: 'count' }]).toArray();
      assert.equal(missing.length, 0);
    }
    console.log('PASS: fresh/repeat seed, preserved password/content, counts and references.');
  } finally {
    if (mongoose.connection.name === dbName && dbName.startsWith('courtsim_test_seed_')) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }

});
