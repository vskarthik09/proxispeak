import mongoose from 'mongoose';
const presenceSchema = new mongoose.Schema({
  meetingId:{type:String,required:true,index:true},
  userId:{type:mongoose.Schema.Types.ObjectId,required:true},
  socketId:{type:String,required:true},
  name:String,avatar:String,handRaised:{type:Boolean,default:false},
  // Virtual-office coordinates are mapped to valid GeoJSON longitude/latitude.
  location:{type:{type:String,enum:['Point'],default:'Point'},coordinates:{type:[Number],required:true}},
  x:{type:Number,default:50},y:{type:Number,default:50},updatedAt:{type:Date,default:Date.now}
});
presenceSchema.index({location:'2dsphere'});
presenceSchema.index({meetingId:1,userId:1},{unique:true});
export default mongoose.model('Presence',presenceSchema);
