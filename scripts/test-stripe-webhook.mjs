import Stripe from "stripe";

const secret = process.env.STRIPE_WEBHOOK_SECRET;

if (!secret) {
  console.error("Missing STRIPE_WEBHOOK_SECRET.");
  process.exit(1);
}

const event = {
  id: "evt_local_test_" + Date.now(),
  object: "event",
  type: "customer.subscription.updated",
  data: {
    object: {
      id: "sub_local_test",
      customer: "cus_local_test",
      status: "active",
      metadata: {
        tier: "jpvos:test"
      }
    }
  }
};

const payload = JSON.stringify(event);

const header = Stripe.webhooks.generateTestHeaderString({
  payload,
  secret
});

const response = await fetch("https://jaypv-os.jaypventuresllc.com/api/webhooks/stripe", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "stripe-signature": header
  },
  body: payload
});

console.log(response.status);
console.log(await response.text());
