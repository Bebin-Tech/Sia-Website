import React,{useState} from 'react';
import {api,Field,instagram} from './shared.jsx';
const upiId='delsia0711@okicici';
export function Payment({order}) {
  const [amount,setAmount]=useState(''),[agreed,setAgreed]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const paise=Math.round(Number(amount)*100);
  const valid=agreed&&/^\d+(\.\d{1,2})?$/.test(amount)&&paise>=100&&paise<=100000000;
  const uri='upi://pay?'+new URLSearchParams({pa:upiId,pn:'Delsia 0711',cu:'INR',am:valid?(paise/100).toFixed(2):'',tn:order?.reference||'Sia studio payment'}).toString();
  async function report(e){
    e.preventDefault();setBusy(true);setError('');
    try{const transactionId=new FormData(e.currentTarget).get('transactionId');const r=await api('/api/payments/report',{method:'POST',body:JSON.stringify({reference:order.reference,accessKey:order.accessKey,amount:paise,transactionId})});setMessage('Payment details saved. Status: '+r.status+'. The studio will check the bank receipt.');}
    catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <div className="payment-panel"><span className="eyebrow">PAY THE STUDIO · UPI</span><h2>A little closer to yours.</h2><p>Pay only after the studio confirms your final total, including delivery. Opening a payment app or submitting a reference does not confirm payment.</p>{order&&<p className="payment-reference">Your request: <strong>{order.reference}</strong></p>}
    <div className="payment-layout"><div><img className="payment-qr" src="/assets/upi-payment.jpeg" alt="Delsia 0711 UPI payment QR. UPI ID delsia0711@okicici"/><a className="text-link" href="/assets/upi-payment.jpeg" download="siaa-upi-qr.jpeg">Download QR code</a></div><div>
    <h3>Delsia 0711</h3><p className="upi-id">{upiId}</p><p className="hint">Scan with your UPI app, or use the button below on a supported phone. Check the recipient in your payment app before authorising.</p>
    <Field label="Studio-confirmed total (INR)"><input type="number" min="1" max="1000000" step="0.01" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Enter the agreed total"/></Field>
    <label className="check-label"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/><span>The studio has confirmed this total and asked me to pay.</span></label>
    {valid?<a className="button" href={uri}>Pay ₹{(paise/100).toFixed(2)} with UPI ↗</a>:<button disabled>Confirm your total to pay</button>}
    <p className="hint">When scanning the QR, enter the agreed total yourself. If the button does not open an app, scan or download the QR instead.</p>
    {order?.accessKey?<form onSubmit={report}><h3>Already paid?</h3><Field label="12-digit UPI reference (UTR)"><input name="transactionId" inputMode="numeric" pattern="[0-9]{12}" minLength="12" maxLength="12" required placeholder="From your payment receipt"/></Field><button disabled={!valid||busy||!!message}>{busy?'Saving…':'Submit for verification'}</button></form>:<p className="hint">Send your order reference and payment receipt to the studio on Instagram. Orders placed in this browser can submit a UPI reference here.</p>}
    {message&&<p className="success" role="status">{message}</p>}{error&&<p className="error" role="alert">{error}</p>}
    <a className="text-link" href={instagram} target="_blank" rel="noopener">Contact the studio ↗</a>
    </div></div></div>;
}
