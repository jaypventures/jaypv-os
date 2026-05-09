import crypto from "node:crypto";

const secret = process.env.JPV_INTERNAL_SIGNING_SECRET;

if (!secret) {
  console.error("Missing local JPV_INTERNAL_SIGNING_SECRET.");
  process.exit(1);
}

const payload = {
  subjectId: process.argv[2] || "test-subject",
  requestedAccess: process.argv[3] || "jpvos:test",
  source: "local-runtime-test"
};

const body = JSON.stringify(payload);

const signature = crypto
  .createHmac("sha256", secret)
  .update(body)
  .digest("hex");

const response = await fetch("https://jaypv-os.jaypventuresllc.com/api/entitlements/check", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-jpv-signature": signature
  },
  body
});

console.log(response.status);
console.log(await response.text());
