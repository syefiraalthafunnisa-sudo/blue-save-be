// Run: node -r ts-node/register tests/local-seed-media.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const records = [];
const completed = [];
const client = require.resolve("@prisma/client");
require.cache[client] = {
  id: client,
  filename: client,
  loaded: true,
  exports: {
    PrismaClient: class {
      constructor() {
        const model = { create: async ({ data }) => records.push(data) };
        this.report = this.news = this.event = model;
        completed.push(new Promise((resolve) => { this.$disconnect = async () => resolve(); }));
      }
    },
  },
};

async function main() {
  for (const name of ["report", "news", "event"]) {
    require(`../prisma/seeders/${name}Seeder`);
  }
  await Promise.all(completed);
  assert.equal(records.length, 13);
  for (const record of records) {
    const media = record.media ?? record.image;
    assert.ok(media.startsWith("/images/"));
    assert.equal(fs.existsSync(path.join(root, "public", media)), true);
  }
  const svg = fs.readFileSync(path.join(root, "public/images/placeholder.svg"), "utf8");
  assert.equal(/<image\b|<script\b|(?:href|src)=/i.test(svg), false);
  console.log("PASS: all 13 seeded images exist locally, with no external image resources");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
