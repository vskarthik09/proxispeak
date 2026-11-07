import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Meeting from '../models/Meeting.js';
import Presence from '../models/Presence.js';
export function attachRealtime(io) {
  io.use((socket,next) => {
    try {
      const token = socket.handshake.auth?.token;
      socket.user = jwt.verify(token,process.env.JWT_SECRET);
      next();
    } catch { next(new Error('Unauthorized')); }
  });
  const rooms = new Map();
  const emitRoster = async roomId => {
    // Read shared presence from MongoDB so room rosters work across Redis-connected API instances.
    const members = await Presence.find({meetingId:roomId}).select('socketId userId name avatar handRaised x y').lean();
    io.to(roomId).emit('room:roster',{participants:members,count:members.length});
  };
  io.on('connection', socket => {
    socket.on('room:join', async ({meetingId},ack=()=>{}) => {
      const id = String(meetingId || '').toUpperCase();
      const meeting = await Meeting.findOne({meetingId:id,isActive:true});
      if (!meeting) return ack({ok:false,message:'Meeting not found or ended.'});
      const user = await User.findById(socket.user.id).select('name avatar');
      if (!user) return ack({ok:false,message:'User account not found.'});
      socket.join(id); socket.data.roomId=id;
      if (!rooms.has(id)) rooms.set(id,new Map());
      const roster=rooms.get(id);
      const existing=[...roster.values()];
      const x=Math.random()*70+15,y=Math.random()*60+20;
      roster.set(socket.id,{socketId:socket.id,userId:user._id.toString(),name:user.name,avatar:user.avatar,handRaised:false,x,y});
      await Presence.findOneAndUpdate({meetingId:id,userId:user._id},{meetingId:id,userId:user._id,socketId:socket.id,name:user.name,avatar:user.avatar,x,y,location:{type:'Point',coordinates:[x/100*360-180,90-y/100*180]},updatedAt:new Date()},{upsert:true,new:true});
      socket.to(id).emit('peer:new',{socketId:socket.id});
      emitRoster(id);
      ack({ok:true,meeting:{meetingId:id,title:meeting.title,roomType:meeting.roomType},participants:existing});
    });
    for (const event of ['webrtc:offer','webrtc:answer','webrtc:ice','chat:message','participant:hand','participant:position']) {
      socket.on(event, payload => {
        const room=socket.data.roomId; if (!room) return;
        if (event==='chat:message') {
          const message={id:`${Date.now()}-${socket.id}`,text:String(payload?.text||'').slice(0,2000),sender:socket.user.name,avatar:payload?.avatar || '🧑‍🚀',createdAt:new Date().toISOString()};
          io.to(room).emit('chat:message',message);
        } else if (event==='participant:hand') {
          const member=rooms.get(room)?.get(socket.id); if(member) member.handRaised=!!payload?.raised;
          Presence.findOneAndUpdate({meetingId:room,userId:socket.user.id},{handRaised:!!payload?.raised}).catch(()=>{});
          emitRoster(room);
        } else if (event==='participant:position') {
          const member=rooms.get(room)?.get(socket.id); if(member){
            member.x=Math.max(2,Math.min(98,Number(payload.x)||50));member.y=Math.max(2,Math.min(98,Number(payload.y)||50));
            Presence.findOneAndUpdate({meetingId:room,userId:socket.user.id},{socketId:socket.id,x:member.x,y:member.y,location:{type:'Point',coordinates:[member.x/100*360-180,90-member.y/100*180]},updatedAt:new Date()}).catch(()=>{});
          }
          socket.to(room).emit(event,{socketId:socket.id,x:payload.x,y:payload.y});
        } else {
          if (payload?.to) io.to(payload.to).emit(event,{from:socket.id,...payload});
        }
      });
    }
    socket.on('disconnect',()=>{
      const room=socket.data.roomId; if(!room) return;
      rooms.get(room)?.delete(socket.id);
      Presence.deleteOne({meetingId:room,socketId:socket.id}).catch(()=>{});
      socket.to(room).emit('peer:left',{socketId:socket.id});
      emitRoster(room);
      if (rooms.get(room)?.size===0) rooms.delete(room);
    });
  });
}
