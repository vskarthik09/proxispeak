export const rtcConfig={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
export async function getMedia(video=true){return navigator.mediaDevices.getUserMedia({audio:true,video:video?{width:{ideal:1280},height:{ideal:720},facingMode:'user'}:false});}
