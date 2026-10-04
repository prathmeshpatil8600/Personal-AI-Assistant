const SIMPLE=new Set(["DAILY","WEEKLY","MONTHLY"]);
export function normalizeRecurrence(value){
 if(value==null||value==="")return null;
 const s=String(value).trim().toUpperCase();
 if(SIMPLE.has(s))return s;
 if(s.startsWith("RRULE:")){
  if(!/^RRULE:FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,;+\-]+)*$/.test(s)) throw new Error("Invalid recurrence rule.");
  return s;
 }
 throw new Error("Recurrence must be DAILY, WEEKLY, MONTHLY, or a supported RRULE.");
}