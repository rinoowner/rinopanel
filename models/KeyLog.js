import mongoose from 'mongoose';

const keyLogSchema = new mongoose.Schema({
  userId: Number,
  count: Number
});

export default mongoose.model('KeyLog', keyLogSchema);
