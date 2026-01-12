(function(){
  // PDF rules
  const INN_OVERS = 10;
  const PP_OVERS = 3;
  const MAX_OVERS_PER_BOWLER = 2;

  function emptyMatchState(meta){
    return {
      meta,
      status: "UPCOMING", // UPCOMING | LIVE | DONE
      toss: null,         // { winner:"A"|"B", decision:"BAT"|"BOWL" }
      squads: { A: [], B: [] },    // 15 list (optional)
      xi: { A: [], B: [] },        // playing XI names
      currentInnings: 1,           // 1 or 2
      innings: {
        1: newInnings("A"),
        2: newInnings("B")
      },
      strike: { striker:null, nonStriker:null, bowler:null },
      overBalls: [],       // current over legal balls labels for UI
      ballLog: [],         // full log
      result: null         // after finalize
    };
  }

  function newInnings(teamKey){
    return {
      team: teamKey, // "A" or "B"
      runs: 0,
      wkts: 0,
      legalBalls: 0, // legal deliveries only
      extras: { wd:0, nb:0, b:0, lb:0 },
      bats: {},      // name -> {r,b,4,6,out,how}
      bowls: {},     // name -> {balls, runs, wkts, wd, nb}
      fow: []        // [{wkt, runs, over, batter}]
    };
  }

  function oversFromBalls(legalBalls){
    const o = Math.floor(legalBalls/6);
    const b = legalBalls%6;
    return `${o}.${b}`;
  }

  function isInningsComplete(inn){
    return inn.wkts >= 10 || inn.legalBalls >= INN_OVERS*6;
  }

  function ensureBatter(inn, name){
    if(!name) return;
    if(!inn.bats[name]) inn.bats[name] = { r:0,b:0, _4:0,_6:0, out:false, how:"" };
  }
  function ensureBowler(inn, name){
    if(!name) return;
    if(!inn.bowls[name]) inn.bowls[name] = { balls:0, runs:0, wkts:0, wd:0, nb:0 };
  }

  // Ball shape:
  // { kind:"RUN|WD|NB|B|LB|WKT", runs:number, wicket?:{type, batter}, note?, ts }
  // RUN: legal ball counts; WD/NB not legal; B/LB legal with runs; WKT legal counts.
  function applyBall(state, ball){
    const innNo = state.currentInnings;
    const inn = state.innings[innNo];

    // validations: must have bowler for legal/illegal? (we enforce for any ball)
    const bowler = state.strike.bowler;
    if(!bowler) return { ok:false, err:"Bowler select करें" };
    ensureBowler(inn, bowler);

    const pp = (inn.legalBalls < PP_OVERS*6);

    // Bowlers overs limit check (count only legal balls for bowler, but NB/WD also attributed)
    const bstat = inn.bowls[bowler];
    const bowlerLegalBalls = bstat.balls; // we store legal balls only in balls
    const bowlerOvers = Math.floor(bowlerLegalBalls/6);
    if(ball.kind !== "WD" && ball.kind !== "NB"){ // legal ball
      if(bowlerOvers >= MAX_OVERS_PER_BOWLER) return { ok:false, err:`Bowler max ${MAX_OVERS_PER_BOWLER} overs limit` };
    } else {
      // Even on WD/NB we allow, but if already completed 2 overs, still can bowl wides/no-balls? Real rules: cannot exceed over count; practically you can't start a 3rd over. We'll block if already 2 overs complete.
      if(bowlerOvers >= MAX_OVERS_PER_BOWLER && (bowlerLegalBalls % 6) === 0) return { ok:false, err:`Bowler max ${MAX_OVERS_PER_BOWLER} overs limit` };
    }

    const striker = state.strike.striker;
    const nonStriker = state.strike.nonStriker;

    // striker required for most balls
    if(!striker || !nonStriker) return { ok:false, err:"Striker/Non-striker select करें" };

    ensureBatter(inn, striker);
    ensureBatter(inn, nonStriker);

    const addToBowlerRuns = (r)=>{ bstat.runs += r; };
    const addLegalBallToBowler = ()=>{ bstat.balls += 1; };
    const swapStrike = ()=>{ const t=state.strike.striker; state.strike.striker=state.strike.nonStriker; state.strike.nonStriker=t; };

    // Apply ball
    if(ball.kind === "WD"){
      const r = 1 + (ball.runs||0);
      inn.runs += r;
      inn.extras.wd += r;
      bstat.wd += r;
      addToBowlerRuns(r);
      // not legal, no batter ball
      // strike same
      state.overBalls.push(`WD${ball.runs?`+${ball.runs}`:""}`);
    }
    else if(ball.kind === "NB"){
      const r = 1 + (ball.runs||0);
      inn.runs += r;
      inn.extras.nb += r;
      bstat.nb += r;
      addToBowlerRuns(r);
      // not legal ball (we are using tennis ball rules; keep standard: NB not legal)
      state.overBalls.push(`NB${ball.runs?`+${ball.runs}`:""}`);
      // if runs taken off the bat: here simplified as total in ball.runs (can be 0/1/2/4/6). We won't increment batter ball on NB in this phase.
      if((ball.runs||0) % 2 === 1) swapStrike();
    }
    else if(ball.kind === "RUN"){
      const r = ball.runs||0;
      inn.runs += r;
      inn.bats[striker].r += r;
      inn.bats[striker].b += 1;
      if(r===4) inn.bats[striker]._4 += 1;
      if(r===6) inn.bats[striker]._6 += 1;

      inn.legalBalls += 1;
      addLegalBallToBowler();
      addToBowlerRuns(r);

      state.overBalls.push(String(r));
      if(r % 2 === 1) swapStrike();
    }
    else if(ball.kind === "B" || ball.kind === "LB"){
      const r = ball.runs||0;
      inn.runs += r;
      if(ball.kind==="B") inn.extras.b += r;
      else inn.extras.lb += r;

      // batter faced ball
      inn.bats[striker].b += 1;

      inn.legalBalls += 1;
      addLegalBallToBowler();
      addToBowlerRuns(r);

      state.overBalls.push(ball.kind==="B" ? `B${r}` : `LB${r}`);
      if(r % 2 === 1) swapStrike();
    }
    else if(ball.kind === "WKT"){
      // wicket on legal ball (LBW not used; type must not be LBW)
      if(ball.wicketType && String(ball.wicketType).toUpperCase().includes("LBW")){
        return { ok:false, err:"PDF rule: LBW लागू नहीं है" };
      }

      inn.legalBalls += 1;
      addLegalBallToBowler();
      inn.bats[striker].b += 1;

      inn.wkts += 1;
      bstat.wkts += 1;

      inn.bats[striker].out = true;
      inn.bats[striker].how = ball.wicketType || "OUT";
      inn.fow.push({ wkt: inn.wkts, runs: inn.runs, over: oversFromBalls(inn.legalBalls), batter: striker });

      state.overBalls.push("W");

      // next batter must be selected by scorer; keep striker null to force selection
      state.strike.striker = null;

      if(isInningsComplete(inn)){
        // innings complete → switch
      }
    }
    else {
      return { ok:false, err:"Unknown ball type" };
    }

    // Over end: after 6 legal balls → swap strike and clear overBalls
    if(inn.legalBalls>0 && (inn.legalBalls % 6) === 0){
      // swap strike at over end
      if(state.strike.striker && state.strike.nonStriker) {
        const t=state.strike.striker; state.strike.striker=state.strike.nonStriker; state.strike.nonStriker=t;
      }
      state.overBalls = [];
    }

    // Auto status
    state.status = "LIVE";

    // Innings completion switch (auto)
    if(isInningsComplete(inn)){
      if(state.currentInnings === 1){
        state.currentInnings = 2;
        // reset strike selections for innings 2
        state.strike = { striker:null, nonStriker:null, bowler:null };
        state.overBalls = [];
      } else {
        // match complete; scorer will finalize result explicitly
      }
    }

    // log
    state.ballLog.push({
      ...ball,
      strikerBefore: striker,
      bowler,
      inn: innNo,
      pp,
      over: oversFromBalls(inn.legalBalls),
      ts: Date.now()
    });

    return { ok:true, state };
  }

  function undo(state){
    if(!state.ballLog.length) return state;

    // Rebuild from scratch using meta/toss/xi etc.
    const meta = state.meta;
    const base = emptyMatchState(meta);
    base.toss = state.toss;
    base.squads = state.squads;
    base.xi = state.xi;

    const log = [...state.ballLog];
    base.ballLog = [];
    base.status = "UPCOMING";
    base.currentInnings = 1;
    base.strike = { striker:null, nonStriker:null, bowler:null };
    base.overBalls = [];

    // We also need to replay strike selections — so we store special events in log? (Phase 3.1)
    // For now: only undo last ball without rebuilding strike selection logic:
    // Practical approach: store strike selections inside each ball (strikerBefore etc.) and restore them pre-apply.
    log.pop(); // remove last ball

    for(const b of log){
      // restore selections from log record
      if(b.inn) base.currentInnings = b.inn;
      base.strike.bowler = b.bowler || base.strike.bowler;
      // if strikerBefore exists and current striker missing set it:
      if(!base.strike.striker && b.strikerBefore) base.strike.striker = b.strikerBefore;
      if(!base.strike.nonStriker){
        // best effort: keep nonStriker as previous value if present
        base.strike.nonStriker = base.strike.nonStriker || "NONSTRIKER";
      }
      applyBall(base, b);
    }

    return base;
  }

  window.ENG = { emptyMatchState, applyBall, undo, oversFromBalls, INN_OVERS, PP_OVERS, MAX_OVERS_PER_BOWLER };
})();
