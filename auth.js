import {Router} from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
const router = Router();
const publicUser = u => ({id:u._id, name:u.name, email:u.email, avatar:u.avatar});
router.post('/signup', async (req,res) => {
  try {
    const {name,email,password,avatar} = req.body || {};
    if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 8)
      return res.status(400).json({message:'Enter a name, valid email, and password (8+ characters).'});
    if (await User.findOne({email:email.toLowerCase()})) return res.status(409).json({message:'An account with this email already exists.'});
    const user = await User.create({name,email,passwordHash:await bcrypt.hash(password,12),avatar:avatar || '🧑‍🚀'});
    const token = jwt.sign({id:user._id.toString(),name:user.name,email:user.email},process.env.JWT_SECRET,{expiresIn:'7d'});
    res.status(201).json({token,user:publicUser(user)});
  } catch(e) { res.status(500).json({message:'Could not create account.'}); }
});
router.post('/login', async (req,res) => {
  const {email,password} = req.body || {};
  const user = await User.findOne({email:(email || '').toLowerCase()});
  if (!user || !await bcrypt.compare(password || '',user.passwordHash)) return res.status(401).json({message:'Incorrect email or password.'});
  const token = jwt.sign({id:user._id.toString(),name:user.name,email:user.email},process.env.JWT_SECRET,{expiresIn:'7d'});
  res.json({token,user:publicUser(user)});
});
router.get('/me', async (req,res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({message:'Account not found'});
  res.json({user:publicUser(user)});
});
export default router;
