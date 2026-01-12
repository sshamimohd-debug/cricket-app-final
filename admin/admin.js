(function(){
  const $ = (s)=>document.querySelector(s);
  const PIN = "1127"; // demo only (Phase 3 में हटेगा)

  $("#btnLogin").addEventListener("click", ()=>{
    const v = ($("#pin").value||"").trim();
    if(v === PIN){
      localStorage.setItem("mpl_admin", "1");
      location.href = "scorer.html";
    }else{
      $("#msg").textContent = "Wrong PIN. Demo PIN: 1127";
    }
  });
})();
