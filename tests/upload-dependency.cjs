// Run: node -r ts-node/register tests/upload-dependency.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { PassThrough } = require("node:stream");

async function main() {
  const originalCwd = process.cwd();
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "upload-check-"));
  process.chdir(directory);
  const upload = require("../src/middlewares/upload").default.single("media");
  const files = path.join(directory, "uploads/reports");
  const parse = (filename, mime) => new Promise((resolve, reject) => {
    const body = Buffer.from(`--test-boundary\r\nContent-Disposition: form-data; name="media"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\nsample\r\n--test-boundary--\r\n`);
    const req = new PassThrough();
    req.method = "POST";
    req.headers = {
      "content-type": "multipart/form-data; boundary=test-boundary",
      "content-length": String(body.length),
    };
    upload(req, {}, (error) => error ? reject(error) : resolve(req.file));
    req.end(body);
  });
  try {
    const file = await parse("example.png", "image/png");
    assert.match(file.filename, /^[0-9a-f-]{36}\.png$/);
    assert.equal(fs.readFileSync(file.path, "utf8"), "sample");
    fs.unlinkSync(file.path);
    await assert.rejects(parse("example.exe", "image/png"), /Invalid file extension/);
    await assert.rejects(parse("example.png", "text/html"), /Invalid MIME type/);
    assert.deepEqual(fs.readdirSync(files), []);
    console.log("PASS: multipart disk upload and extension/MIME rejection on updated Multer");
  } finally {
    process.chdir(originalCwd);
    for (const name of fs.readdirSync(files)) fs.unlinkSync(path.join(files, name));
    fs.rmdirSync(files);
    fs.rmdirSync(path.join(directory, "uploads"));
    fs.rmdirSync(directory);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
