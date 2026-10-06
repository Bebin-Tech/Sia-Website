import React from 'react';
import {money} from './shared.jsx';
import {orderPricing} from '../pricing.mjs';
export function OrderSummary({items}) {
  const pricing=orderPricing(items);
  return <section className="order-summary" aria-label="Order price summary"><h3>Your pieces</h3>{items.map((i,index)=><div className="summary-row" key={index}><span>{i.quantity} × {i.name}{i.variant==='pair'?' — Pair (2 pieces)':''}<small>{money({price:i.unitPrice,currency:i.currency})} {i.variant==='pair'?'per pair':'each'}</small></span><strong>{money({price:i.unitPrice===null?null:i.unitPrice*i.quantity,currency:i.currency})}</strong></div>)}<div className="summary-row summary-total"><span>{pricing.quoteRequired?'Priced items subtotal':'Product total'}</span><strong>{money({price:pricing.subtotal,currency:'INR'})}</strong></div><p className="hint">{pricing.quoteRequired?'Some items need a quote. Your final total will be confirmed by the studio.':'Calculated from your selected quantities. Delivery and any customisation charges are confirmed separately.'}</p></section>;
}
