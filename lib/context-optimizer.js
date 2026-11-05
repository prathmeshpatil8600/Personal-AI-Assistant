export function estimateTokens(value){
 const text=typeof value==="string"?value:JSON.stringify(value??"");
 return Math.max(1,Math.ceil(text.length/4));
}

function clipTail(text,maxChars){
 const s=String(text||"");
 return s.length<=maxChars?s:s.slice(s.length-maxChars);
}

export function contextPolicy(profile={}){
 const lane=String(profile.lane||"STANDARD").toUpperCase();
 if(lane==="DEEP")return {targetInputTokens:14000,summaryChars:6500,memoryChars:4200,pinChars:3500,recentChars:14000};
 if(lane==="CHEAP")return {targetInputTokens:6500,summaryChars:2800,memoryChars:1700,pinChars:1400,recentChars:6500};
 return {targetInputTokens:9500,summaryChars:4200,memoryChars:2800,pinChars:2200,recentChars:9500};
}

export function buildContextPacket({summary="",memories=[],pins=[],messages=[],profile={}}){
 const p=contextPolicy(profile);
 const summaryText=clipTail(summary,p.summaryChars);
 let memoryText=(memories||[]).map(m=>"- "+m.memory_key+": "+String(m.memory_value||"")).join("\n");
 if(memoryText.length>p.memoryChars)memoryText=memoryText.slice(0,p.memoryChars);
 let pinText=(pins||[]).map(x=>"- "+String(x.label||"Pinned context")+": "+String(x.content||"")).join("\n");
 if(pinText.length>p.pinChars)pinText=pinText.slice(0,p.pinChars);

 const originalTokens=estimateTokens(messages);
 let used=0,out=[];
 for(let i=messages.length-1;i>=0;i--){
  const m=messages[i],content=String(m?.content||"");
  const room=p.recentChars-used;if(room<=0)break;
  const clipped=content.length>room?content.slice(content.length-room):content;
  out.unshift({...m,content:clipped});used+=clipped.length;
 }
 const packedTokens=estimateTokens(out);
 return {
  summary:summaryText||"No older conversation summary yet.",
  memories:memoryText||"No relevant saved memories.",
  pins:pinText||"No pinned conversation context.",
  messages:out,
  estimatedRecentTokens:packedTokens,
  estimatedTokensSaved:Math.max(0,originalTokens-packedTokens),
  budget:p
 };
}

export function outputBudgetFor(profile={}){
 const lane=String(profile.lane||"STANDARD").toUpperCase();
 if(lane==="DEEP")return 2200;
 if(lane==="CHEAP")return 700;
 return 1200;
}