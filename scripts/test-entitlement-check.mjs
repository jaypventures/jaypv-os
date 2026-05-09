import crypto from "node:crypto";

const secret = process.env.JPV_INTERNAL_SIGNING_SECRET;

if (!secret) {
  console.error("Missing JPV_INTERNAL_SIGNING_SECRET in local environment.");
  process.exit(1);
}

const payload = {
  subjectId: "local-test-subject",
  requestedAccess: "jpvos:test",
  source: "local-script"
};

const rawBody = JSON.stringify(payload);

const signature = crypto
  .createHmac("sha256", secret)
  .update(rawBody)
  .digest("hex");

const response = await fetch("https://jaypv-os.jaypventuresllc.com/api/entitlements/check", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-jpv-signature": signature
  },
  body: rawBody
});

console.log(response.status);
console.log(await response.text());
