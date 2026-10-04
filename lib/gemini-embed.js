function normalize(values){
 const norm=Math.sqrt(values.reduce((sum,v)=>sum+v*v,0));
 if(!norm) throw new Error("Gemini returned a zero-length embedding.");
 return values.map(v=>v/norm);
}

export async function embedText(input, taskType="RETRIEVAL_QUERY", title){
 const key=process.env.GOOGLE_API_KEY;
 if(!key) throw new Error("GOOGLE_API_KEY is not available to the embedding runtime.");
 const body={model:"models/gemini-embedding-001",content:{parts:[{text:input}]},taskType,outputDimensionality:1536};
 if(taskType==="RETRIEVAL_DOCUMENT" && title) body.title=title;
 const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key="+encodeURIComponent(key),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
 if(!r.ok){const t=await r.text();throw new Error("Gemini embeddings request failed ("+r.status+"): "+t.slice(0,300));}
 const data=await r.json();
 const values=data?.embedding?.values;
 if(!Array.isArray(values)||values.length!==1536) throw new Error("Gemini embeddings response did not contain a 1536-dimensional embedding.");
 return normalize(values);
}