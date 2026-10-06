// Amounts are integer paise. Unpriced/non-INR items require a studio quote.
export function orderPricing(items) {
  const quoteRequired = !items.length || items.some(i => !Number.isSafeInteger(i.unitPrice) || i.unitPrice < 1 || i.currency !== 'INR');
  const subtotal = items.reduce((sum, i) => sum + (Number.isSafeInteger(i.unitPrice) && i.currency === 'INR' ? i.unitPrice * i.quantity : 0), 0);
  return { subtotal, total: quoteRequired ? null : subtotal, currency: 'INR', quoteRequired, delivery: 'Confirmed separately' };
}
