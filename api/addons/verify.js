import { db } from "hatchable";
import { razorpayRequest,verifyRazorpayPaymentSignature } from "../../lib/razorpay.js";
import { grantAddon } from "../../lib/addons.js";
export const access="user";
export const methods=["POST"];
export default async function(req,res){
 const orderId=String(req.body?.razorpay_order_id||"").trim();
 const paymentId=String(req.body?.razorpay_payment_id||"").trim();
 const signature=String(req.body?.razorpay_signature||"").trim();
 if(!orderId||!paymentId||!signature)return res.status(400).json({error:"Payment verification fields are required."});
 const order=(await db.query("SELECT * FROM addon_orders WHERE user_id=$1 AND provider_order_id=$2 LIMIT 1",[req.user.id,orderId])).rows[0];
 if(!order)return res.status(404).json({error:"Add-on order not found."});
 if(order.status==="PAID"){
  let grant=(await db.query("SELECT id,addon_code,effects,starts_at,expires_at FROM addon_grants WHERE addon_order_id=$1 LIMIT 1",[order.id])).rows[0];
  if(!grant)grant=await grantAddon({userId:req.user.id,addonCode:order.addon_code,orderId:order.id,source:"PURCHASE"});
  return res.json({ok:true,idempotent:true,order_status:"PAID",grant});
 }
 if(order.status!=="CREATED")return res.status(409).json({error:"Order is not payable.",status:order.status});
 let valid=false;try{valid=await verifyRazorpayPaymentSignature({orderId,paymentId,signature})}catch(e){return res.status(503).json({error:"billing_setup_required",message:String(e.message||e).slice(0,300)})}
 if(!valid)return res.status(400).json({error:"invalid_payment_signature"});
 try{
  const payment=await razorpayRequest("/payments/"+encodeURIComponent(paymentId));
  if(String(payment?.order_id||"")!==orderId||Number(payment?.amount)!==Number(order.amount_inr)*100||String(payment?.currency||"")!==order.currency||String(payment?.status||"")!=="captured"){
   return res.status(409).json({error:"payment_not_captured",message:"The payment has not been verified as captured for this order."});
  }
  const paid=(await db.query("UPDATE addon_orders SET provider_payment_id=$1,status='PAID',paid_at=now(),updated_at=now() WHERE id=$2 AND user_id=$3 AND status='CREATED' RETURNING id,addon_code",[paymentId,order.id,req.user.id])).rows[0];
  if(!paid){
   const existing=(await db.query("SELECT id,addon_code FROM addon_orders WHERE id=$1 AND user_id=$2 AND status='PAID'",[order.id,req.user.id])).rows[0];
   if(!existing)return res.status(409).json({error:"payment_state_conflict"});
  }
  const grant=await grantAddon({userId:req.user.id,addonCode:order.addon_code,orderId:order.id,source:"PURCHASE"});
  res.json({ok:true,order_status:"PAID",grant});
 }catch(e){res.status(e.status||502).json({error:"payment_verification_failed",message:String(e.message||e).slice(0,300)})}
}