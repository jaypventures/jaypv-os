export function mapStripeEventToEntitlement(event) {
  const object = event?.data?.object;
  const type = event?.type;

  if (!object) {
    return null;
  }

  if (
    type === "checkout.session.completed" ||
    type === "customer.subscription.created" ||
    type === "customer.subscription.updated"
  ) {
    const customerId = object.customer || object.customer_id;
    const subscriptionId = object.subscription || object.id;
    const status = object.status || "active";

    return {
      id: `stripe_${subscriptionId}`,
      subject_id: String(customerId || subscriptionId),
      subject_type: "stripe_customer",
      tier: object.metadata?.tier || object.metadata?.requestedAccess || "jpvos:community",
      status: status === "active" || status === "complete" ? "active" : status,
      source: "stripe",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  if (
    type === "customer.subscription.deleted" ||
    type === "customer.subscription.paused"
  ) {
    const customerId = object.customer || object.customer_id;
    const subscriptionId = object.id;

    return {
      id: `stripe_${subscriptionId}`,
      subject_id: String(customerId || subscriptionId),
      subject_type: "stripe_customer",
      tier: object.metadata?.tier || object.metadata?.requestedAccess || "jpvos:community",
      status: "inactive",
      source: "stripe",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  return null;
}
