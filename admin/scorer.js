(function(){
  const $ = (s)=>document.querySelector(s);

  if(localStorage.getItem("mpl_admin") !== "1"){
    location.href = "index.html";
    return;
  }

  $("#logout").addEventListener("click", ()=>{
    localStorage.removeItem("mpl_admin");
    location.href = "index.html";
  });

  function mid(){ return ($("#matchId").value||"A1").trim() || "A1"; }

  function render(){
    const st = DB.getMatchState(mid());
    const inn = st.innings[st.currentInnings];
    $("#out").innerHTML = `
      <div class="h2">Live: ${inn.runs}/${inn.wickets} <span class="muted">(${U.fmtOvers(inn.balls)})</span></div>
      <div class="muted small">Status: ${st.status} • Balls: ${st.ballLog.length}</div>
    `;
  }

  const add = (ball)=>{ DB.pushBall(mid(), ball); render(); };

  document.querySelectorAll("[data-run]").forEach(b=>{
    b.addEventListener("click", ()=>{
      add({ type:"RUN", runs: parseInt(b.getAttribute("data-run"),10), label: b.getAttribute("data-run") });
    });
  });

  $("#W").addEventListener("click", ()=> add({ type:"RUN", runs:0, wicket:true, label:"W" }));
  $("#WD").addEventListener("click", ()=> add({ type:"WD", runs:0, label:"WD" }));
  $("#NB").addEventListener("click", ()=> add({ type:"NB", runs:0, label:"NB" }));
  $("#UNDO").addEventListener("click", ()=>{ DB.undoBall(mid()); render(); });

  render();
})();
