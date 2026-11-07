import {Router} from 'express';
import Presence from '../models/Presence.js';
const router=Router();
// Find nearby avatars using MongoDB's spherical $near operator.
router.get('/:id/nearby',async(req,res)=>{
  const lng=Number(req.query.lng),lat=Number(req.query.lat),radius=Math.min(Number(req.query.radius)||15,1000);
  if(!Number.isFinite(lng)||!Number.isFinite(lat))return res.status(400).json({message:'Valid lng and lat are required.'});
  const people=await Presence.find({meetingId:req.params.id.toUpperCase(),location:{$near:{$geometry:{type:'Point',coordinates:[lng,lat]},$maxDistance:radius}}}).select('name avatar x y socketId');
  res.json({participants:people});
});
// Find avatars contained in a virtual-office GeoJSON area using $geoWithin.
router.post('/:id/within',async(req,res)=>{
  const {polygon}=req.body||{};
  if(!polygon||polygon.type!=='Polygon'||!Array.isArray(polygon.coordinates))return res.status(400).json({message:'A GeoJSON Polygon is required.'});
  const people=await Presence.find({meetingId:req.params.id.toUpperCase(),location:{$geoWithin:{$geometry:polygon}}}).select('name avatar x y socketId');
  res.json({participants:people});
});
export default router;
