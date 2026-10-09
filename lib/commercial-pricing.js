export const PRICING_STATUS="PROVISIONAL_TEST_PRICE";
export const CURRENCY="INR";
export const COMMERCIAL_PRICES={
 FREE:{MONTHLY:0,ANNUAL:0},
 PLUS:{MONTHLY:499,ANNUAL:4999},
 PRO:{MONTHLY:1499,ANNUAL:14999}
};
export function priceInr(planCode,cycle){
 const p=COMMERCIAL_PRICES[String(planCode||"").toUpperCase()];
 const v=p?.[String(cycle||"").toUpperCase()];
 return Number.isFinite(Number(v))?Number(v):null;
}
export function monthlyRevenueInr(planCode,cycle){
 const p=priceInr(planCode,cycle);
 if(p===null)return null;
 return String(cycle||"").toUpperCase()==="ANNUAL"?p/12:p;
}