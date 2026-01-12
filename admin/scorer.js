(async function(){
  const $ = (s)=>document.querySelector(s);
  const msg = $("#msg");
  const who = $("#who");
  const matchIdEl = $("#matchId");

  const say = (t)=> msg.textContent = t;

  if(!window.FB){
    say("Error: firebase.js not loaded.");
    return;
  }

  const FBX = await FB.initFirebase();
  const { auth, au, fs, db, getMyRole } = FBX;

  // must be logged in
  if(!auth.currentUser){
    say("Not logged in. Please login again.");
    location.href = `index.html?v=${Date.now()}`;
    return;
  }

  const uid = auth.currentUser.uid;
  const role = await getMyRole(uid);
  who.textContent = `UID: ${uid} • Role: ${role}`;

  if(role !== "admin" && role !== "scorer"){
    say("Role public है. Firestore users/{UID} में role=admin/scorer करें.");
    return;
  }

  $("#btnLogout").addEventListener("click", async ()=>{
    await au.signOut(auth);
    location.href = `index.html?v=${Date.now()}`;
  });

  function refMatch(mid){
    return fs.doc(db, "matches", mid);
  }

  async function ensureMatch(mid){
    const ref = refMatch(mid);
    const snap = await fs.getDoc(ref);
    if(!snap.exists()){
      await fs.setDoc(ref, {
        status:"UPCOMING",
        currentInnings: 1,
        innings: {
          1: { runs:0, wkts:0, balls:0 },
          2: { runs:0, wkts:0, balls:0 }
        },
        lastBalls: [],
        updatedAt: fs.serverTimestamp(),
        updatedBy: uid
      }, { merge:true });
    }
    return ref;
  }

  async function applyEvent(mid, evt){
    const ref = await ensureMatch(mid);
    const snap = await fs.getDoc(ref);
    const d = snap.data() || {};
    const inn = d.currentInnings || 1;
    const innObj = (d.innings && d.innings[inn]) ? d.innings[inn] : { runs:0, wkts:0, balls:0 };

    let runs = innObj.runs || 0;
    let wkts = innObj.wkts || 0;
    let balls = innObj.balls || 0;

    const lastBalls = Array.isArray(d.lastBalls) ? d.lastBalls.slice() : [];

    if(evt === "UNDO"){
      lastBalls.pop();
      await fs.updateDoc(ref, { lastBalls, updatedAt: fs.serverTimestamp(), updatedBy: uid });
      return;
    }

    if(evt.startsWith("RUN:")){
      const v = parseInt(evt.split(":")[1], 10) || 0;
      runs += v;
      balls += 1;
      lastBalls.push(String(v));
    }else if(evt === "W"){
      wkts += 1;
      balls += 1;
      lastBalls.push("W");
    }else if(evt === "WD"){
      runs += 1;
      lastBalls.push("WD");
    }else if(evt === "NB"){
      runs += 1;
      lastBalls.push("NB");
    }

    while(lastBalls.length > 24) lastBalls.shift();

    await fs.updateDoc(ref, {
      status: "LIVE",
      [`innings.${inn}.runs`]: runs,
      [`innings.${inn}.wkts`]: wkts,
      [`innings.${inn}.balls`]: balls,
      lastBalls,
      updatedAt: fs.serverTimestamp(),
      updatedBy: uid
    });
  }

  $("#btnLoad").addEventListener("click", async ()=>{
    const mid = (matchIdEl.value||"").trim();
    await ensureMatch(mid);
    say(`Loaded match ${mid}`);
  });

  $("#btnLive").addEventListener("click", async ()=>{
    const mid = (matchIdEl.value||"").trim();
    const ref = await ensureMatch(mid);
    await fs.updateDoc(ref, { status:"LIVE", updatedAt: fs.serverTimestamp(), updatedBy: uid });
    say(`Match ${mid} set LIVE`);
  });

  document.querySelectorAll("[data-run]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const mid = (matchIdEl.value||"").trim();
      const v = btn.getAttribute("data-run");
      await applyEvent(mid, `RUN:${v}`);
      say(`Ball: ${v}`);
    });
  });

  $("#btnW").addEventListener("click", async ()=>{
    const mid = (matchIdEl.value||"").trim();
    await applyEvent(mid, "W");
    say("Ball: W");
  });

  $("#btnWD").addEventListener("click", async ()=>{
    const mid = (matchIdEl.value||"").trim();
    await applyEvent(mid, "WD");
    say("Ball: WD");
  });

  $("#btnNB").addEventListener("click", async ()=>{
    const mid = (matchIdEl.value||"").trim();
    await applyEvent(mid, "NB");
    say("Ball: NB");
  });

  $("#btnUndo").addEventListener("click", async ()=>{
    const mid = (matchIdEl.value||"").trim();
    await applyEvent(mid, "UNDO");
    say("Undo");
  });

  say("Ready. Load match and start scoring.");
})();
