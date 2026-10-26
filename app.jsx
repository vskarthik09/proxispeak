import React, { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SERVER = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const W = 1000, H = 600, RANGE = 260;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export default function App() {
  const [name, setName] = useState(""), [room, setRoom] = useState("lobby");
  const [joined, setJoined] = useState(false), [self, setSelf] = useState(null);
  const [peers, setPeers] = useState([]), [muted, setMuted] = useState(false), [error, setError] = useState("");
  const canvas = useRef(null), socket = useRef(null), me = useRef(null), peerList = useRef([]);
  const stream = useRef(null), audio = useRef(null), pcs = useRef(new Map()), nodes = useRef(new Map()), lastEmit = useRef(0);
  useEffect(() => { me.current = self; peerList.current = peers; }, [self, peers]);

  const closePeer = id => {
    pcs.current.get(id)?.close(); pcs.current.delete(id);
    const n = nodes.current.get(id);
    if (n) { try { n.source.disconnect(); n.pan.disconnect(); n.gain.disconnect(); } catch {} }
    nodes.current.delete(id);
  };

  const updateAudio = useCallback(() => {
    if (!me.current || !audio.current) return;
    peerList.current.forEach(p => {
      const n = nodes.current.get(p.socketId); if (!n) return;
      const d = distance(me.current, p);
      const volume = d >= RANGE ? 0 : Math.pow(1 - d / RANGE, 1.5);
      const pan = clamp((p.x - me.current.x) / 180, -1, 1);
      n.gain.gain.setTargetAtTime(volume, audio.current.currentTime, .08);
      n.pan.pan.setTargetAtTime(pan, audio.current.currentTime, .08);
    });
  }, []);
  useEffect(() => { updateAudio(); }, [self, peers, updateAudio]);

  const makePeer = useCallback((id, initiator) => {
    if (pcs.current.has(id)) return pcs.current.get(id);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    pcs.current.set(id, pc);
    stream.current?.getTracks().forEach(t => pc.addTrack(t, stream.current));
    pc.onicecandidate = e => {
      if (e.candidate) socket.current?.emit("rtc:signal", { to: id, signal: { candidate: e.candidate } });
    };
    pc.ontrack = e => {
      if (nodes.current.has(id) || !audio.current) return;
      const source = audio.current.createMediaStreamSource(e.streams[0]);
      const pan = audio.current.createStereoPanner(), gain = audio.current.createGain();
      gain.gain.value = 0; source.connect(pan); pan.connect(gain); gain.connect(audio.current.destination);
      nodes.current.set(id, { source, pan, gain }); updateAudio();
    };
    if (initiator) pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => {
      socket.current?.emit("rtc:signal", { to: id, signal: { description: pc.localDescription } });
    }).catch(console.error);
    return pc;
  }, [updateAudio]);

  async function join(e) {
    e.preventDefault(); setError("");
    if (!name.trim()) { setError("Enter your name."); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      audio.current = new (window.AudioContext || window.webkitAudioContext)(); await audio.current.resume();
      const s = io(SERVER); socket.current = s;
      s.on("connect_error", () => setError("Backend connection failed. Check port 4000."));
      s.on("room:members", list => {
  setPeers(
    list.filter(p => p.socketId !== s.id)
  );
});
      s.on("peer:joined", p => {
        setPeers(old => old.some(x => x.socketId === p.socketId) ? old : [...old, p]);
        if (me.current) makePeer(p.socketId, true);
      });
      s.on("position:update", d => setPeers(old => old.map(p => p.socketId === d.socketId ? { ...p, x: d.x, y: d.y } : p)));
      s.on("peer:left", ({ socketId }) => { closePeer(socketId); setPeers(old => old.filter(p => p.socketId !== socketId)); });
      s.on("rtc:signal", async ({ from, signal }) => {
        try {
          const pc = makePeer(from, false);
          if (signal.description) {
            await pc.setRemoteDescription(signal.description);
            if (signal.description.type === "offer") {
              await pc.setLocalDescription(await pc.createAnswer());
              s.emit("rtc:signal", { to: from, signal: { description: pc.localDescription } });
            }
          } else if (signal.candidate) await pc.addIceCandidate(signal.candidate);
        } catch (err) { console.error("WebRTC signaling error", err); }
      });
      s.emit("room:join", {
  name: name.trim(),
  room: room.trim() || "lobby"
}, result => {
  if (!result?.ok) return;

  setSelf(result.self);
  setPeers(result.peers);
  setJoined(true);
});
    } catch (err) {
      setError(err.name === "NotAllowedError" ? "Allow microphone permission to join." : "Microphone unavailable. Use localhost or HTTPS.");
      console.error(err);
    }
  }

  const move = useCallback((x, y) => {
    setSelf(old => {
      if (!old) return old;
      const next = { ...old, x: clamp(x, 15, W - 15), y: clamp(y, 15, H - 15) };
      me.current = next;
      if (Date.now() - lastEmit.current > 65) {
        socket.current?.emit("position:update", { x: next.x, y: next.y }); lastEmit.current = Date.now();
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!joined) return;
    const key = e => {
      const k = e.key.toLowerCase();
      if (!["w","a","s","d","arrowup","arrowdown","arrowleft","arrowright"].includes(k)) return;
      if (["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)) return;
      e.preventDefault(); const p = me.current; if (!p) return;
      const step = e.shiftKey ? 24 : 12;
      move(p.x + (["d","arrowright"].includes(k) ? step : ["a","arrowleft"].includes(k) ? -step : 0),
           p.y + (["s","arrowdown"].includes(k) ? step : ["w","arrowup"].includes(k) ? -step : 0));
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [joined, move]);

  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const g = c.getContext("2d"); let frame;
    const draw = () => {
      g.clearRect(0, 0, W, H); g.fillStyle = "#0c1426"; g.fillRect(0, 0, W, H); g.strokeStyle = "#1a2941";
      for (let x=0; x<=W; x+=40) { g.beginPath(); g.moveTo(x,0); g.lineTo(x,H); g.stroke(); }
      for (let y=0; y<=H; y+=40) { g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); }
      if (self) {
        g.beginPath(); g.arc(self.x,self.y,RANGE,0,Math.PI*2); g.fillStyle="#4eddb80b"; g.fill();
        g.strokeStyle="#4eddb844"; g.setLineDash([6,8]); g.stroke(); g.setLineDash([]);
      }
      peers.forEach(p => {
        const d = self ? distance(self,p) : Infinity;
        g.beginPath(); g.moveTo(self?.x||0,self?.y||0); g.lineTo(p.x,p.y);
        g.strokeStyle=d<RANGE?"#4eddb833":"#77849e22"; g.stroke();
        g.beginPath(); g.arc(p.x,p.y,10,0,Math.PI*2); g.fillStyle=d<RANGE?"#4eddb8":"#77849e"; g.fill();
        g.font="12px sans-serif"; g.textAlign="center"; g.fillStyle="#eef3ff"; g.fillText(p.name,p.x,p.y-18);
      });
      if (self) {
        g.beginPath(); g.arc(self.x,self.y,17,0,Math.PI*2); g.fillStyle="#7b8cff33"; g.fill();
        g.beginPath(); g.arc(self.x,self.y,10,0,Math.PI*2); g.fillStyle="#7b8cff"; g.fill();
        g.font="bold 12px sans-serif"; g.textAlign="center"; g.fillStyle="#fff"; g.fillText(self.name+" (you)",self.x,self.y-20);
      }
      frame=requestAnimationFrame(draw);
    };
    draw(); return () => cancelAnimationFrame(frame);
  }, [self, peers]);

  function mapClick(e) {
    const r=canvas.current.getBoundingClientRect();
    move((e.clientX-r.left)/r.width*W,(e.clientY-r.top)/r.height*H);
  }
  function toggleMute() {
    const next=!muted; stream.current?.getAudioTracks().forEach(t => t.enabled=!next); setMuted(next);
  }
  function leave() {
    socket.current?.disconnect(); pcs.current.forEach(pc=>pc.close()); pcs.current.clear();
    nodes.current.forEach(n=>{try{n.source.disconnect();n.pan.disconnect();n.gain.disconnect();}catch{}}); nodes.current.clear();
    stream.current?.getTracks().forEach(t=>t.stop()); audio.current?.close();
    socket.current=null; stream.current=null; audio.current=null; setJoined(false); setSelf(null); me.current=null; setPeers([]); setMuted(false);
  }

  return <div className="app">
    <header><div className="brand"><span>〰</span><div><b>ProxiSpeak</b><small>SPATIAL AUDIO ECOSYSTEM</small></div></div>
      <div className="topStatus"><i className={joined?"online":""}/>{joined?"Connected":"Ready"}<span>{joined?`ROOM / ${room}`:"REAL-TIME COMMUNICATION"}</span></div>
    </header>
    {!joined ? <main className="landing">
      <section className="intro"><div className="eyebrow">● REAL-TIME SPATIAL COMMUNICATION</div>
        <h1>Talk to people<br/><em>around you.</em></h1>
        <p>A virtual space where conversations happen naturally. Move closer to talk, step away to fade out.</p>
        <div className="features"><span>◉ Proximity audio</span><span>↔ Free movement</span><span>♫ Peer-to-peer</span></div>
      </section>
      <form className="join" onSubmit={join}><small>GET STARTED</small><h2>Enter your space</h2><p>Choose a name and join a room to begin.</p>
        <label>DISPLAY NAME<input value={name} maxLength="32" onChange={e=>setName(e.target.value)} placeholder="e.g. Karthik" required/></label>
        <label>ROOM NAME<input value={room} maxLength="40" onChange={e=>setRoom(e.target.value)} required/></label>
        <button type="submit">Join room <b>→</b></button>{error&&<div className="error">{error}</div>}
        <div className="privacy">🎙 Microphone permission is needed for voice chat.</div>
      </form>
      <div className="landingfoot"><span>● WEBRTC AUDIO</span><span>Built for natural conversations</span><span>Web-based virtual rooms</span></div>
    </main> : <main className="workspace">
      <div className="heading"><div><div className="eyebrow">LIVE VIRTUAL SPACE</div><h1>{room} <small>LIVE</small></h1><p>Move around to change who you can hear.</p></div><div className="live">● Session active</div></div>
      <div className="columns"><section className="panel map">
        <div className="panelhead"><div><b>↔ Spatial map</b><p>Click anywhere to move your avatar</p></div><small>● You　 <i>●</i> In range</small></div>
        <canvas ref={canvas} width={W} height={H} onClick={mapClick}/><div className="mapfoot">↔ WASD / arrow keys to move <span>Audio range: {RANGE} units</span></div>
      </section><aside className="panel side">
        <div className="panelhead"><div><b>♧ People nearby</b><p>Same room participants</p></div><strong>{peers.length+1}</strong></div>
        <div className="person you"><div className="avatar">{(self?.name||"Y")[0].toUpperCase()}</div><div><b>{self?.name} <small>YOU</small></b><p>{muted?"Microphone muted":"Microphone active"}</p></div><span>{muted?"⊘":"♫"}</span></div>
        {peers.map((p,i)=>{const d=distance(self,p),near=d<RANGE;return <div className="person" key={p.socketId}><div className={`avatar a${i%4}`}>{p.name[0]?.toUpperCase()}</div><div><b>{p.name}</b><p>{near?Math.round(d)+" units away":"Out of range"}</p></div><span className={near?"hearing":"silent"}>♫</span></div>})}
        {!peers.length&&<div className="empty"><b>No one else here yet</b><p>Open another tab and join this room to test audio.</p></div>}
        <div className="range"><b>{peers.filter(p=>distance(self,p)<RANGE).length} people in audio range</b><p>Volume fades with distance</p></div>
        <div className="actions"><button className="secondary" onClick={toggleMute}>{muted?"Unmute":"Mute"} mic</button><button className="leave" onClick={leave}>Leave room</button></div>
      </aside></div>
      <div className="hint">ⓘ Spatial audio uses distance-based volume and left/right panning. Use headphones and allow microphone access.</div>
    </main>}
    <footer><span>PROXISPEAK © 2026</span><span>React · WebRTC · Socket.IO · MongoDB</span><span>Spatial audio demo</span></footer>
  </div>;
}
