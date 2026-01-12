(async function(){
  const $ = (s)=>document.querySelector(s);
  const out = $("#out");
  const err = $("#err");
  const strikeMsg = $("#strikeMsg");

  const FBX = await FB.initFirebase();
  const { auth, au, getMyRole, db, fs } = FBX;

  const matchRef = (id)=> fs.doc(db, "matches", id);

  function mid(){ return ($("#matchId").value||"A1").trim() || "A1"; }

  let unsub = null;
  let current = null;

  async function guard(){
    if(!auth.currentUser){
      location.href = "index.html"; return false;
    }
    const role = await getMyRole(auth.currentUser.uid);
    if(role !== "admin" && role !== "scorer"){
      err.textContent = "Access denied: role scorer/admin required.";
      return false;
    }
    return true;
  }

  $("#logout").addEventListener("click", async ()=>{
    await au.signOut(auth);
    location.href = "index.html";
  });

  $("#load").addEventListener("click", async ()=>{
    err.textContent = "";
    if(!await guard()) return;

    const id = mid();
    // Ensure doc exists
    const snap = await fs.getDoc(matchRef(id));
    if(!snap.exists()){
      err.textContent = "Match doc not found. Open public Home once to auto-create, or create manually.";
      return;
    }

    if(unsub) unsub();
    unsub = fs.onSnapshot(matchRef(id), (s)=>{
      if(!s.exists()) return;
      current = s.data();
      render();
    });
  });

  $("#setLive").addEventListener("click", async ()=>{
    if(!await guard()) return;
    await fs.updateDoc(matchRef(mid()), { status:"LIVE", updatedAt: fs.serverTimestamp() });
  });

  $("#applyStrike").addEventListener("click", async ()=>{
    if(!await guard()) return;
    if(!current){ strikeMsg.textContent = "Load match first"; return; }

    const striker = ($("#striker").value||"").trim();
    const non = ($("#nonstriker").value||"").trim();
    const bowler = ($("#bowler").value||"").trim();
    if(!striker || !non || !bowler){
      strikeMsg.textContent = "Striker, Non-striker, Bowler तीनों भरें"; return;
    }
    current.strike = { striker, nonStriker: non, bowler };
    strikeMsg.textContent = "Applied ✅";
    await fs.updateDoc(matchRef(mid()), { strike: current.strike, updatedAt: fs.serverTimestamp() });
  });

  function render(){
    const inn = current.innings?.[current.currentInnings] || {runs:0,wkts:0,legalBalls:0,extras:{}};
    out.innerHTML = `
      <div class="h2">${current.meta.teamA} vs ${current.meta.teamB} • Match ${current.meta.id}</div>
      <div class="kpi">
        <div class="pill"><b>${inn.runs}/${inn.wkts}</b></div>
        <div class="pill">Overs <b>${ENG.oversFromBalls(inn.legalBalls)}</b></div>
        <div class="pill">Innings <b>${current.currentInnings}</b></div>
        <div class="pill">PP <b>${inn.legalBalls < ENG.PP_OVERS*6 ? "ON" : "OFF"}</b></div>
      </div>
      <div class="muted small">Strike: ${U.esc(current.strike?.striker||"-")} / ${U.esc(current.strike?.nonStriker||"-")} • Bowler: ${U.esc(current.strike?.bowler||"-")}</div>
      <div class="muted small">Extras: WD ${inn.extras?.wd||0}, NB ${inn.extras?.nb||0}, B ${inn.extras?.b||0}, LB ${inn.extras?.lb||0}</div>
    `;
  }

  async function pushBall(ball){
    err.textContent = "";
    if(!await guard()) return;
    if(!current){ err.textContent = "Load match first"; return; }

    const res = ENG.applyBall(current, ball);
    if(!res.ok){ err.textContent = res.err; return; }

    // write back entire state (simple + safe)
    await fs.setDoc(matchRef(mid()), { ...res.state, updatedAt: fs.serverTimestamp() }, { merge:true });
  }

  document.querySelectorAll("[data-run]").forEach(b=>{
    b.addEventListener("click", ()=> pushBall({ kind:"RUN", runs: parseInt(b.getAttribute("data-run"),10) }));
  });

  $("#WD").addEventListener("click", ()=> pushBall({ kind:"WD", runs:0 }));
  $("#NB").addEventListener("click", ()=> pushBall({ kind:"NB", runs:0 }));
  $("#B1").addEventListener("click", ()=> pushBall({ kind:"B", runs:1 }));
  $("#LB1").addEventListener("click", ()=> pushBall({ kind:"LB", runs:1 }));

  $("#WKT").addEventListener("click", ()=>{
    const wktType = ($("#wktType").value||"OUT").trim();
    pushBall({ kind:"WKT", wicketType: wktType });
  });

  $("#UNDO").addEventListener("click", async ()=>{
    err.textContent = "";
    if(!await guard()) return;
    if(!current){ err.textContent = "Load match first"; return; }
    const rebuilt = ENG.undo(current);
    await fs.setDoc(matchRef(mid()), { ...rebuilt, updatedAt: fs.serverTimestamp() }, { merge:true });
  });

  // Auto guard: if user already logged-in keep here else redirect
  au.onAuthStateChanged(auth, async (u)=>{
    if(!u) location.href = "index.html";
  });
})();
