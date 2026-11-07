import {Router} from 'express';
const router = Router();
router.post('/', async (req,res) => {
  const {text,target,source='auto'} = req.body || {};
  if (!text || !target) return res.status(400).json({message:'Text and target language are required.'});
  if (!process.env.LIBRETRANSLATE_URL) return res.status(503).json({message:'Translation provider is not configured. Set LIBRETRANSLATE_URL in backend/.env.'});
  try {
    const response = await fetch(process.env.LIBRETRANSLATE_URL.replace(/\/$/,'') + '/translate', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({q:String(text).slice(0,4000),source,target,format:'text',api_key:process.env.LIBRETRANSLATE_API_KEY || undefined})
    });
    const data = await response.json();
    if (!response.ok) return res.status(502).json({message:data.error || 'Translation service error.'});
    res.json({translatedText:data.translatedText});
  } catch { res.status(502).json({message:'Could not reach translation provider.'}); }
});
export default router;
