export function submitGatewayCheckout(checkout) {
  const allowed = ['https://pay-sandbox.sepay.vn/v1/checkout/init', 'https://pay.sepay.vn/v1/checkout/init'];
  if (checkout?.method !== 'POST' || !allowed.includes(checkout.url) || !checkout.fields?.signature) {
    throw new Error('Invalid checkout');
  }
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = checkout.url;
  form.hidden = true;
  // Object.entries preserves the field order used by the server to sign the checkout.
  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  }
  document.body.appendChild(form);
  try { HTMLFormElement.prototype.submit.call(form); }
  finally { form.remove(); }
}
