import { useState, useCallback } from "react";

const ADMIN_PASSWORD = "***REMOVED***";

const initialTeams = {
  A: ["Team A1", "Team A2", "Team A3"],
  B: ["Team B1", "Team B2", "Team B3"],
  C: ["Team C1", "Team C2", "Team C3", "Team C4"],
};

function generateMatches(teams, group) {
  const matches = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      matches.push({ id: `${group}-${i}-${j}`, home: teams[i], away: teams[j], homeScore: "", awayScore: "", wo: "none", yellowHome: 0, yellowAway: 0, redHome: 0, redAway: 0 });
  return matches;
}

const initMatches = {
  A: generateMatches(initialTeams.A, "A"),
  B: generateMatches(initialTeams.B, "B"),
  C: generateMatches(initialTeams.C, "C"),
};

function calcStats(teams, matches) {
  const stats = {};
  teams.forEach(t => stats[t] = { team: t, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, yc: 0, rc: 0, cards: 0 });
  matches.forEach(m => {
    if (m.wo === "none" && (m.homeScore === "" || m.awayScore === "")) return;
    let hs, as_, hw, hd, hl, aw, ad, al;
    if (m.wo === "home_wo") { hs=3;as_=0;hw=1;hd=0;hl=0;aw=0;ad=0;al=1; }
    else if (m.wo === "away_wo") { hs=0;as_=3;hw=0;hd=0;hl=1;aw=1;ad=0;al=0; }
    else {
      hs=parseInt(m.homeScore);as_=parseInt(m.awayScore);
      if(hs>as_){hw=1;hd=0;hl=0;aw=0;ad=0;al=1;}
      else if(hs<as_){hw=0;hd=0;hl=1;aw=1;ad=0;al=0;}
      else{hw=0;hd=1;hl=0;aw=0;ad=1;al=0;}
    }
    const h=stats[m.home],a=stats[m.away];
    h.p++;h.w+=hw;h.d+=hd;h.l+=hl;h.gf+=hs;h.ga+=as_;h.gd+=hs-as_;h.pts+=hw*3+hd;
    a.p++;a.w+=aw;a.d+=ad;a.l+=al;a.gf+=as_;a.ga+=hs;a.gd+=as_-hs;a.pts+=aw*3+ad;
    h.yc+=parseInt(m.yellowHome)||0;h.rc+=parseInt(m.redHome)||0;
    a.yc+=parseInt(m.yellowAway)||0;a.rc+=parseInt(m.redAway)||0;
  });
  Object.values(stats).forEach(s=>s.cards=s.yc+s.rc*2);
  const arr=Object.values(stats);
  arr.sort((a,b)=>{
    if(b.pts!==a.pts)return b.pts-a.pts;
    if(b.gd!==a.gd)return b.gd-a.gd;
    const h2h=matches.find(m=>(m.home===a.team&&m.away===b.team)||(m.home===b.team&&m.away===a.team));
    if(h2h&&h2h.homeScore!==""&&h2h.awayScore!==""){
      const hs=parseInt(h2h.homeScore),as_=parseInt(h2h.awayScore);
      const aWin=(h2h.home===a.team&&hs>as_)||(h2h.away===a.team&&as_>hs);
      const bWin=(h2h.home===b.team&&hs>as_)||(h2h.away===b.team&&as_>hs);
      if(aWin)return -1;if(bWin)return 1;
    }
    return a.cards-b.cards;
  });
  return arr;
}

const COLORS={A:"#3b82f6",B:"#10b981",C:"#f59e0b"};
const BG={A:"#eff6ff",B:"#ecfdf5",C:"#fffbeb"};

// ─── LOGIN SCREEN ───────────────────────────────────────────────
function LoginScreen({ onLogin, onBack }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const submit = () => {
    if (pw === ADMIN_PASSWORD) { onLogin(); }
    else { setErr(true); setPw(""); }
  };
  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#1e3a5f,#2563eb)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:20, padding:"40px 36px", width:340, boxShadow:"0 20px 60px #0004" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:40, marginBottom:8 }}>🔐</div>
          <div style={{ fontWeight:800, fontSize:20, color:"#1e293b" }}>Admin Login</div>
          <div style={{ color:"#94a3b8", fontSize:13, marginTop:4 }}>Masukkan password untuk mengedit data</div>
        </div>
        <input type="password" placeholder="Password admin..." value={pw}
          onChange={e=>{setPw(e.target.value);setErr(false);}}
          onKeyDown={e=>e.key==="Enter"&&submit()}
          style={{ width:"100%", padding:"12px 14px", border:`2px solid ${err?"#ef4444":"#e2e8f0"}`, borderRadius:10, fontSize:14, outline:"none", boxSizing:"border-box", marginBottom:8 }} />
        {err && <div style={{ color:"#ef4444", fontSize:12, marginBottom:8 }}>❌ Password salah, coba lagi.</div>}
        <button onClick={submit} style={{ width:"100%", padding:"12px", background:"linear-gradient(135deg,#2563eb,#1d4ed8)", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:14, cursor:"pointer", marginBottom:10 }}>
          Masuk sebagai Admin
        </button>
        <button onClick={onBack} style={{ width:"100%", padding:"10px", background:"#f1f5f9", color:"#64748b", border:"none", borderRadius:10, fontWeight:600, fontSize:13, cursor:"pointer" }}>
          ← Kembali ke Tampilan Publik
        </button>
      </div>
    </div>
  );
}

// ─── STANDINGS TABLE (shared) ────────────────────────────────────
function StandingsTable({ grp, stats, isAdmin }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
        <thead>
          <tr style={{ background:"#f8fafc" }}>
            {["#","Tim","M","M","S","K","GM","GK","SG","🟡","🔴","Poin"].map((h,i)=>(
              <th key={i} style={{ padding:"8px 6px", color:"#64748b", textAlign:i<2?"left":"center", fontWeight:600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stats.map((s,i)=>{
            const isAdv=(grp==="C"&&i<2)||(grp!=="C"&&i===0);
            const isRu=grp==="C"&&i===1;
            return(
              <tr key={s.team} style={{ borderBottom:"1px solid #f1f5f9", background:isAdv?BG[grp]:"#fff" }}>
                <td style={{ padding:"8px 6px", fontWeight:700, color:isAdv?COLORS[grp]:"#94a3b8" }}>{i+1}{isAdv?"✓":""}</td>
                <td style={{ padding:"8px 6px", fontWeight:600, color:"#1e293b" }}>
                  {s.team}
                  {isAdv&&!isRu&&<span style={{ fontSize:10, background:COLORS[grp], color:"#fff", borderRadius:4, padding:"1px 4px", marginLeft:4 }}>Lolos</span>}
                  {isRu&&<span style={{ fontSize:10, background:"#f59e0b", color:"#fff", borderRadius:4, padding:"1px 4px", marginLeft:4 }}>Runner Up</span>}
                </td>
                {[s.p,s.w,s.d,s.l,s.gf,s.ga].map((v,j)=>(
                  <td key={j} style={{ padding:"8px 6px", textAlign:"center", color:j===1?"#10b981":j===2?"#f59e0b":j===3?"#ef4444":"#1e293b" }}>{v}</td>
                ))}
                <td style={{ padding:"8px 6px", textAlign:"center", fontWeight:600, color:s.gd>0?"#10b981":s.gd<0?"#ef4444":"#64748b" }}>{s.gd>0?"+":""}{s.gd}</td>
                <td style={{ padding:"8px 6px", textAlign:"center" }}>{s.yc}</td>
                <td style={{ padding:"8px 6px", textAlign:"center" }}>{s.rc}</td>
                <td style={{ padding:"8px 6px", textAlign:"center", fontWeight:700, color:COLORS[grp], fontSize:14 }}>{s.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── PUBLIC VIEW ─────────────────────────────────────────────────
function PublicView({ teams, matches, onAdminClick }) {
  const [tab, setTab] = useState("standings");
  const statsA=calcStats(teams.A,matches.A);
  const statsB=calcStats(teams.B,matches.B);
  const statsC=calcStats(teams.C,matches.C);
  const semifinalists=[statsA[0],statsB[0],statsC[0],statsC[1]];

  const matchResult = (m) => {
    if (m.wo==="home_wo") return { score:"3 - 0", label:"WO", color:"#7c3aed" };
    if (m.wo==="away_wo") return { score:"0 - 3", label:"WO", color:"#7c3aed" };
    if (m.homeScore===""||m.awayScore==="") return null;
    return { score:`${m.homeScore} - ${m.awayScore}`, label:"", color:"#1e293b" };
  };

  return (
    <div style={{ fontFamily:"Inter,sans-serif", background:"#f8fafc", minHeight:"100vh", padding:16 }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#1e3a5f,#2563eb)", borderRadius:16, padding:"20px 24px", marginBottom:20, color:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>⚽ Turnamen Futsal</h1>
            <p style={{ margin:"4px 0 0", opacity:0.8, fontSize:13 }}>10 Tim · 3 Grup · Live Standings</p>
          </div>
          <button onClick={onAdminClick} style={{ background:"#ffffff22", border:"1px solid #ffffff44", color:"#fff", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
            🔐 Admin
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {[["standings","📊 Klasemen"],["schedule","📋 Jadwal & Hasil"],["advance","🏆 Tim Lolos"]].map(([k,v])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:13, background:tab===k?"#2563eb":"#fff", color:tab===k?"#fff":"#64748b", boxShadow:tab===k?"0 2px 8px #2563eb44":"0 1px 3px #0001" }}>{v}</button>
          ))}
        </div>

        {tab==="standings" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {[["A",statsA],["B",statsB],["C",statsC]].map(([grp,stats])=>(
              <div key={grp} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
                <div style={{ background:COLORS[grp], color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14, display:"flex", justifyContent:"space-between" }}>
                  <span>Grup {grp}</span>
                  <span style={{ fontSize:11, opacity:0.85 }}>{grp==="C"?"Top 2 lolos":"Juara lolos"}</span>
                </div>
                <StandingsTable grp={grp} stats={stats} />
              </div>
            ))}
            <div style={{ background:"#fef9c3", borderRadius:10, padding:"12px 16px", fontSize:12, color:"#92400e", lineHeight:1.7 }}>
              <b>📌 Keterangan:</b> M=Main · Hijau=Menang · Kuning=Seri · Merah=Kalah · GM=Gol Masuk · GK=Gol Kemasukan · SG=Selisih Gol<br/>
              <b>Prioritas Ranking:</b> Poin → Selisih Gol → Head-to-Head → Akumulasi Kartu
            </div>
          </div>
        )}

        {tab==="schedule" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {["A","B","C"].map(grp=>(
              <div key={grp} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
                <div style={{ background:COLORS[grp], color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14 }}>Grup {grp}</div>
                <div style={{ padding:"0 16px 12px" }}>
                  {matches[grp].map((m,i)=>{
                    const res=matchResult(m);
                    return(
                      <div key={m.id} style={{ display:"flex", alignItems:"center", padding:"10px 0", borderBottom:i<matches[grp].length-1?"1px solid #f1f5f9":"none" }}>
                        <div style={{ flex:1, textAlign:"right", fontWeight:600, fontSize:13, color:"#1e293b" }}>{m.home}</div>
                        <div style={{ width:90, textAlign:"center", margin:"0 12px" }}>
                          {res ? (
                            <div style={{ background:res.color==="#7c3aed"?"#f5f3ff":"#f1f5f9", borderRadius:8, padding:"4px 10px" }}>
                              <div style={{ fontWeight:700, color:res.color, fontSize:14 }}>{res.score}</div>
                              {res.label && <div style={{ fontSize:10, color:res.color }}>{res.label}</div>}
                            </div>
                          ) : (
                            <div style={{ background:"#f8fafc", borderRadius:8, padding:"4px 10px", color:"#cbd5e1", fontSize:12, fontWeight:600 }}>VS</div>
                          )}
                        </div>
                        <div style={{ flex:1, textAlign:"left", fontWeight:600, fontSize:13, color:"#1e293b" }}>{m.away}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="advance" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
              <div style={{ background:"#1e3a5f", color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14 }}>🏆 4 Tim Lolos Semifinal</div>
              <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  [statsA[0],"Juara Grup A",COLORS.A],
                  [statsB[0],"Juara Grup B",COLORS.B],
                  [statsC[0],"Juara Grup C",COLORS.C],
                  [statsC[1],"Runner Up Grup C","#10b981"],
                ].map(([s,label,c],i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:10, background:`${c}11`, border:`2px solid ${c}33` }}>
                    <div style={{ width:38, height:38, borderRadius:"50%", background:c, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16 }}>
                      {i<3?"🥇":"🥈"}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{s?.team || <span style={{ color:"#cbd5e1" }}>Belum ditentukan</span>}</div>
                      <div style={{ fontSize:12, color:"#64748b" }}>{label} · {s?.pts ?? 0} poin · SG {s?.gd>=0?"+":""}{s?.gd ?? 0}</div>
                    </div>
                    <div style={{ marginLeft:"auto", background:c, color:"#fff", borderRadius:8, padding:"4px 12px", fontSize:11, fontWeight:700 }}>LOLOS ✓</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background:"#fff", borderRadius:12, padding:16, boxShadow:"0 1px 6px #0001", fontSize:12, color:"#64748b", lineHeight:1.8 }}>
              <b style={{ color:"#1e293b" }}>📜 Sistem Pertandingan</b><br/>
              Menang: 3 poin · Seri: 1 poin · Kalah: 0 poin · WO: Skor 3-0<br/>
              Ranking: Poin → Selisih Gol → Head-to-Head → Kartu<br/>
              Runner Up Terbaik: Poin → Selisih Gol → Kartu → Adu Penalti (3 penendang)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN VIEW ───────────────────────────────────────────────────
function AdminView({ teams, setTeams, matches, setMatches, onLogout }) {
  const [tab, setTab] = useState("group");
  const statsA=calcStats(teams.A,matches.A);
  const statsB=calcStats(teams.B,matches.B);
  const statsC=calcStats(teams.C,matches.C);
  const runnerC=statsC[1];
  const semifinalists=[statsA[0],statsB[0],statsC[0],runnerC];

  const updateMatch=(grp,id,field,val)=>{
    setMatches(prev=>({...prev,[grp]:prev[grp].map(m=>m.id===id?{...m,[field]:val}:m)}));
  };
  const updateTeamName=(grp,idx,val)=>{
    setTeams(prev=>{
      const newTeams={...prev,[grp]:prev[grp].map((t,i)=>i===idx?val:t)};
      setMatches(old=>({...old,[grp]:generateMatches(newTeams[grp],grp)}));
      return newTeams;
    });
  };

  return (
    <div style={{ fontFamily:"Inter,sans-serif", background:"#f8fafc", minHeight:"100vh", padding:16 }}>
      <div style={{ maxWidth:900, margin:"0 auto" }}>
        <div style={{ background:"linear-gradient(135deg,#1e3a5f,#2563eb)", borderRadius:16, padding:"20px 24px", marginBottom:20, color:"#fff", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>⚙️ Panel Admin</h1>
            <p style={{ margin:"4px 0 0", opacity:0.8, fontSize:13 }}>Edit data pertandingan futsal</p>
          </div>
          <button onClick={onLogout} style={{ background:"#ef444422", border:"1px solid #ef444466", color:"#fca5a5", borderRadius:10, padding:"8px 14px", cursor:"pointer", fontSize:12, fontWeight:600 }}>
            🚪 Logout
          </button>
        </div>

        <div style={{ background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:10, padding:"10px 16px", marginBottom:16, fontSize:12, color:"#92400e" }}>
          🔐 <b>Mode Admin Aktif</b> — Anda dapat mengedit nama tim, skor, kartu, dan status WO.
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          {[["group","📋 Grup & Jadwal"],["standings","📊 Klasemen"],["advance","🏆 Tim Lolos"]].map(([k,v])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:"8px 18px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:600, fontSize:13, background:tab===k?"#2563eb":"#fff", color:tab===k?"#fff":"#64748b", boxShadow:tab===k?"0 2px 8px #2563eb44":"0 1px 3px #0001" }}>{v}</button>
          ))}
        </div>

        {tab==="group" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {["A","B","C"].map(grp=>(
              <div key={grp} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
                <div style={{ background:COLORS[grp], color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:15, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span>Grup {grp} {grp==="C"?"(4 Tim)":"(3 Tim)"}</span>
                  <span style={{ fontSize:12, opacity:0.85 }}>{grp==="C"?"Top 2 lolos":"Juara lolos"}</span>
                </div>
                <div style={{ padding:"12px 20px", background:BG[grp], display:"flex", gap:8, flexWrap:"wrap" }}>
                  {teams[grp].map((t,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ fontSize:11, color:"#94a3b8" }}>Tim {i+1}:</span>
                      <input value={t} onChange={e=>updateTeamName(grp,i,e.target.value)}
                        style={{ border:`1px solid ${COLORS[grp]}44`, borderRadius:6, padding:"3px 8px", fontSize:12, fontWeight:600, width:90, color:"#1e293b" }} />
                    </div>
                  ))}
                </div>
                <div style={{ padding:"0 20px 16px" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                    <thead>
                      <tr style={{ background:"#f1f5f9" }}>
                        {["Home","Skor","Away","WO","🟡H","🔴H","🟡A","🔴A"].map((h,i)=>(
                          <th key={i} style={{ padding:"6px 4px", textAlign:i<3?"left":"center", color:"#64748b" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matches[grp].map((m,idx)=>(
                        <tr key={m.id} style={{ borderBottom:"1px solid #f1f5f9", background:idx%2===0?"#fff":"#fafafa" }}>
                          <td style={{ padding:"6px 8px", fontWeight:600, color:"#1e293b" }}>{m.home}</td>
                          <td style={{ padding:"6px 4px", textAlign:"center" }}>
                            {m.wo!=="none"?(
                              <span style={{ color:"#7c3aed", fontWeight:700 }}>{m.wo==="home_wo"?"3 - 0":"0 - 3"}</span>
                            ):(
                              <div style={{ display:"flex", alignItems:"center", gap:3, justifyContent:"center" }}>
                                <input type="number" min="0" value={m.homeScore} onChange={e=>updateMatch(grp,m.id,"homeScore",e.target.value)}
                                  style={{ width:34, textAlign:"center", border:"1px solid #e2e8f0", borderRadius:4, padding:"2px" }} />
                                <span>-</span>
                                <input type="number" min="0" value={m.awayScore} onChange={e=>updateMatch(grp,m.id,"awayScore",e.target.value)}
                                  style={{ width:34, textAlign:"center", border:"1px solid #e2e8f0", borderRadius:4, padding:"2px" }} />
                              </div>
                            )}
                          </td>
                          <td style={{ padding:"6px 8px", fontWeight:600, color:"#1e293b" }}>{m.away}</td>
                          <td style={{ padding:"6px 4px", textAlign:"center" }}>
                            <select value={m.wo} onChange={e=>updateMatch(grp,m.id,"wo",e.target.value)}
                              style={{ fontSize:11, border:"1px solid #e2e8f0", borderRadius:4, padding:"2px 4px" }}>
                              <option value="none">-</option>
                              <option value="home_wo">Home WO</option>
                              <option value="away_wo">Away WO</option>
                            </select>
                          </td>
                          {["yellowHome","redHome","yellowAway","redAway"].map(f=>(
                            <td key={f} style={{ padding:"4px 2px", textAlign:"center" }}>
                              <input type="number" min="0" value={m[f]} onChange={e=>updateMatch(grp,m.id,f,e.target.value)}
                                style={{ width:30, textAlign:"center", border:"1px solid #e2e8f0", borderRadius:4, padding:"2px", fontSize:11 }} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="standings" && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {[["A",statsA],["B",statsB],["C",statsC]].map(([grp,stats])=>(
              <div key={grp} style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
                <div style={{ background:COLORS[grp], color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14 }}>Klasemen Grup {grp}</div>
                <StandingsTable grp={grp} stats={stats} isAdmin />
              </div>
            ))}
          </div>
        )}

        {tab==="advance" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div style={{ background:"#fff", borderRadius:12, overflow:"hidden", boxShadow:"0 1px 6px #0001" }}>
              <div style={{ background:"#1e3a5f", color:"#fff", padding:"12px 20px", fontWeight:700, fontSize:14 }}>🏆 4 Tim Lolos Semifinal</div>
              <div style={{ padding:16, display:"flex", flexDirection:"column", gap:10 }}>
                {[
                  [statsA[0],"Juara Grup A",COLORS.A],
                  [statsB[0],"Juara Grup B",COLORS.B],
                  [statsC[0],"Juara Grup C",COLORS.C],
                  [statsC[1],"Runner Up Grup C","#10b981"],
                ].map(([s,label,c],i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderRadius:10, background:`${c}11`, border:`2px solid ${c}33` }}>
                    <div style={{ width:38, height:38, borderRadius:"50%", background:c, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16 }}>
                      {i<3?"🥇":"🥈"}
                    </div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{s?.team || <span style={{ color:"#cbd5e1" }}>Belum ditentukan</span>}</div>
                      <div style={{ fontSize:12, color:"#64748b" }}>{label} · {s?.pts??0} poin · SG {s?.gd>=0?"+":""}{s?.gd??0}</div>
                    </div>
                    <div style={{ marginLeft:"auto", background:c, color:"#fff", borderRadius:8, padding:"4px 12px", fontSize:11, fontWeight:700 }}>LOLOS ✓</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────
export default function App() {
  const [teams, setTeams] = useState(initialTeams);
  const [matches, setMatches] = useState(initMatches);
  const [mode, setMode] = useState("public"); // public | login | admin

  if (mode === "login") return <LoginScreen onLogin={()=>setMode("admin")} onBack={()=>setMode("public")} />;
  if (mode === "admin") return <AdminView teams={teams} setTeams={setTeams} matches={matches} setMatches={setMatches} onLogout={()=>setMode("public")} />;
  return <PublicView teams={teams} matches={matches} onAdminClick={()=>setMode("login")} />;
}
