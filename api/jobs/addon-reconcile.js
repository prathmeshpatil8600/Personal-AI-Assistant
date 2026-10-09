import { db } from "hatchable";
import { razorpayRequest } from "../../lib/razorpay.js";
export const access="scheduler";
export const methods=["POST"];
export default async function(req,res){
 const rows=(await db.query(`
  SELECT id,user_id,provider_payment_id,amount_inr,status
  FROM addon_orders
  WHERE status='PAID' AND provider_payment_id IS NOT NULL
  ORDER BY updated_at ASC
  LIMIT 500
 `)).rows;
 let checked=0,revoked=0,failed=0;
 for(const row of rows){
  try{
   const payment=await razorpayRequest("/payments/"+encodeURIComponent(row.provider_payment_id));
   checked++;
   const fullyRefunded=Number(payment?.amount_refunded||0)>=Number(row.amount_inr)*100||String(payment?.refund_status||"").toLowerCase()==="full";
   if(fullyRefunded){
    const changed=(await db.query("UPDATE addon_orders SET status='REFUNDED',updated_at=now() WHERE id=$1 AND status='PAID' RETURNING id",[row.id])).rows[0];
    if(changed){await db.query("UPDATE addon_grants SET revoked_at=now() WHERE addon_order_id=$1 AND revoked_at IS NULL",[row.id]);revoked++}
   }
  }catch(e){checked++;failed++}
 }
 res.json({checked,revoked,failed,reconciled_at:new Date().toISOString()});
}