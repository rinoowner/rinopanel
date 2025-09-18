import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  id: Number,
  username: String,
  name: String
});

export default mongoose.model('User', userSchema);
