(function(){
  const KEY = "mpl_db_v1";

  function ensureDB(){
    const db = U.readJSON(KEY, null);
    if(db) return db;

    const fresh = {
      matches: {},     // matchId -> state
      results: {},     // matchId -> final result
      awards: []       // entries
    };
    U.writeJSON(KEY, fresh);
    return fresh;
  }

  function getDB(){ return ensureDB(); }
  function saveDB(db){ U.writeJSON(KEY, db); }

  function getMatchState(matchId){
    const db = getDB();
    if(!db.matches[matchId]){
      db.matches[matchId] = {
        id: matchId,
        status: "UPCOMING", // UPCOMING | LIVE | DONE
        toss: null,
        innings: [
          newInnings("A"),
          newInnings("B")
        ],
        currentInnings: 0,
        ballLog: []
      };
      saveDB(db);
    }
    return db.matches[matchId];
  }

  function newInnings(side){
    return {
      side, // "A" or "B"
      runs: 0,
      wickets: 0,
      balls: 0,
      extras: { wd:0, nb:0, b:0, lb:0 },
      batters: [],
      bowlers: [],
      fow: [] // fall of wickets
    };
  }

  // Minimal scoring (Phase 3 में full validations जोड़ेंगे)
  function pushBall(matchId, ball){
    const db = getDB();
    const st = getMatchState(matchId);
    st.status = "LIVE";

    const inn = st.innings[st.currentInnings];

    // Apply
    if(ball.type === "WD"){
      inn.runs += 1 + (ball.runs||0);
      inn.extras.wd += 1 + (ball.runs||0);
      // wides do not count balls
    } else {
      // legal or no-ball counts? (simple: NB doesn't count as legal ball)
      if(ball.type === "NB"){
        inn.runs += 1 + (ball.runs||0);
        inn.extras.nb += 1 + (ball.runs||0);
        // no-ball does not increment legal ball here (Phase 3 में per rule refine)
      } else {
        inn.runs += (ball.runs||0);
        inn.balls += 1;
        if(ball.wicket){
          inn.wickets += 1;
          inn.fow.push({ atRuns: inn.runs, atOver: U.fmtOvers(inn.balls) });
        }
      }
    }

    st.ballLog.push({ ...ball, ts: Date.now(), i: st.currentInnings });
    db.matches[matchId] = st;
    saveDB(db);
    return st;
  }

  function undoBall(matchId){
    const db = getDB();
    const st = getMatchState(matchId);
    const last = st.ballLog.pop();
    if(!last){ saveDB(db); return st; }

    // Rebuild innings from scratch
    st.innings = [newInnings("A"), newInnings("B")];
    st.status = st.ballLog.length ? "LIVE" : "UPCOMING";

    const log = [...st.ballLog];
    st.ballLog = [];
    st.currentInnings = 0;

    for(const b of log){
      st.currentInnings = b.i || 0;
      pushBallRebuild(st, b);
    }
    db.matches[matchId] = st;
    saveDB(db);
    return st;
  }

  function pushBallRebuild(st, ball){
    const inn = st.innings[ball.i || 0];
    if(ball.type === "WD"){
      inn.runs += 1 + (ball.runs||0);
      inn.extras.wd += 1 + (ball.runs||0);
    } else if(ball.type === "NB"){
      inn.runs += 1 + (ball.runs||0);
      inn.extras.nb += 1 + (ball.runs||0);
    } else {
      inn.runs += (ball.runs||0);
      inn.balls += 1;
      if(ball.wicket){
        inn.wickets += 1;
        inn.fow.push({ atRuns: inn.runs, atOver: U.fmtOvers(inn.balls) });
      }
    }
    st.ballLog.push(ball);
  }

  window.DB = { getMatchState, pushBall, undoBall, getDB, saveDB };
})();
