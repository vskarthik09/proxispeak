import mongoose from 'mongoose';
const meetingSchema = new mongoose.Schema({
  meetingId: {type:String, unique:true, index:true},
  title: {type:String, required:true, maxlength:100},
  roomType: {type:String, enum:['voice','meeting','lounge','conference'], default:'meeting'},
  host: {type:mongoose.Schema.Types.ObjectId, ref:'User', required:true},
  isActive: {type:Boolean, default:true}
}, {timestamps:true});
export default mongoose.model('Meeting', meetingSchema);
