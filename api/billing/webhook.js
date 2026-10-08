export const access="public";
export const methods=["POST"];
export default async function(req,res){
 res.status(503).json({error:"webhook_disabled",message:"Razorpay webhook ingestion is disabled until the runtime exposes a verifiable raw request body. Billing state is reconciled directly with Razorpay instead."});
}