import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import {Server} from 'socket.io';
import {createClient} from 'redis';
import {createAdapter} from '@socket.io/redis-adapter';
import {connectDB} from './config/db.js';
import {auth} from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import meetingRoutes from './routes/meetings.js';
import translateRoutes from './routes/translate.js';
import presenceRoutes from './routes/presence.js';
import {attachRealtime} from './realtime/socket.js';

const app=express(), server=http.createServer(app);
const origins=(process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({origin:origins,credentials:true}));
app.use(express.json({limit:'1mb'}));
app.get('/api/health',(_,res)=>res.json({ok:true,service:'ProxiSpeak API'}));
app.use('/api/auth',authRoutes);
app.use('/api/meetings',auth,meetingRoutes);
app.use('/api/translate',auth,translateRoutes);
app.use('/api/presence',auth,presenceRoutes);
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({message:'Internal server error'});});
const io=new Server(server,{cors:{origin:origins,methods:['GET','POST']}});
app.set('io',io); attachRealtime(io);
const port=process.env.PORT || 4000;
async function start(){
  await connectDB(process.env.MONGODB_URI);
  if(process.env.REDIS_URL){
    const pub=createClient({url:process.env.REDIS_URL}),sub=pub.duplicate();
    pub.on('error',e=>console.error('Redis publisher error',e));sub.on('error',e=>console.error('Redis subscriber error',e));
    await Promise.all([pub.connect(),sub.connect()]);io.adapter(createAdapter(pub,sub));
    console.log('Socket.IO Redis adapter enabled');
  }
  server.listen(port,()=>console.log(`ProxiSpeak API listening on ${port}`));
}
start().catch(err=>{console.error(err);process.exit(1);});
