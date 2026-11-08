// Web Audio spatial mixer: distance controls gain and horizontal position controls stereo pan.
export class SpatialAudioMixer {
  constructor(){this.ctx=null;this.nodes=new Map();}
  async attach(id,stream){
    if(!this.ctx)this.ctx=new (window.AudioContext||window.webkitAudioContext)();
    await this.ctx.resume();
    this.detach(id);
    const source=this.ctx.createMediaStreamSource(stream),gain=this.ctx.createGain(),pan=this.ctx.createStereoPanner();
    source.connect(gain).connect(pan).connect(this.ctx.destination);
    this.nodes.set(id,{source,gain,pan});
  }
  update(id,local,remote){
    const n=this.nodes.get(id);if(!n||!this.ctx)return;
    const dx=remote.x-local.x,dy=remote.y-local.y,d=Math.hypot(dx,dy);
    // Smooth inverse-distance attenuation, clamped to avoid silence at normal room sizes.
    const volume=Math.max(.06,Math.min(1,1/(1+d/24)));
    n.gain.gain.setTargetAtTime(volume,this.ctx.currentTime,.12);
    n.pan.pan.setTargetAtTime(Math.max(-1,Math.min(1,dx/45)),this.ctx.currentTime,.12);
  }
  detach(id){const n=this.nodes.get(id);if(n){try{n.source.disconnect();n.gain.disconnect();n.pan.disconnect();}catch{}this.nodes.delete(id);}}
  close(){for(const id of this.nodes.keys())this.detach(id);this.ctx?.close();this.ctx=null;}
}
