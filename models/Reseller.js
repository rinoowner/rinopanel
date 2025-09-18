import mongoose from 'mongoose';

const resellerSchema = new mongoose.Schema({
  id: Number,
  expires: Date
});

export default mongoose.model('Reseller', resellerSchema);
