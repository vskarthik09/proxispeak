import {Router} from 'express';
import Meeting from '../models/Meeting.js';
const router = Router();
const makeId = () => `PS-${Math.random().toString(36).slice(2,6).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
router.post('/', async (req,res) => {
  const title = (req.body.title || 'Team Meeting').trim().slice(0,100);
  const roomType = ['voice','meeting','lounge','conference'].includes(req.body.roomType) ? req.body.roomType : 'meeting';
  const meeting = await Meeting.create({meetingId:makeId(),title,roomType,host:req.user.id});
  res.status(201).json({meeting});
});
router.get('/:id', async (req,res) => {
  const meeting = await Meeting.findOne({meetingId:req.params.id.toUpperCase(),isActive:true}).populate('host','name avatar');
  if (!meeting) return res.status(404).json({message:'Meeting not found or ended.'});
  res.json({meeting:{meetingId:meeting.meetingId,title:meeting.title,roomType:meeting.roomType,host:meeting.host}});
});
router.post('/:id/end', async (req,res) => {
  const meeting = await Meeting.findOne({meetingId:req.params.id.toUpperCase(),host:req.user.id});
  if (!meeting) return res.status(404).json({message:'Meeting not found or you are not the host.'});
  meeting.isActive=false; await meeting.save(); req.app.get('io').to(req.params.id.toUpperCase()).emit('meeting:ended');
  res.json({ok:true});
});
export default router;
