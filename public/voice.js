let recognition=null;
function startVoiceInput(inputId){
  const input=document.getElementById(inputId);
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){alert("Voice input is not supported in this browser.");return}
  recognition=new SR();recognition.lang="en-IN";recognition.interimResults=true;recognition.continuous=false;
  recognition.onresult=e=>{let t="";for(let i=e.resultIndex;i<e.results.length;i++)t+=e.results[i][0].transcript;input.value=t};
  recognition.onerror=e=>{if(e.error!=="aborted")alert("Voice input error: "+e.error)};
  recognition.start();
}