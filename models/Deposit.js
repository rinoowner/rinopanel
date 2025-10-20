import mongoose from 'mongoose';

const depositSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  username: String,
  amount: { type: Number, required: true },
  razorpayPaymentLinkId: { type: String, unique: true, required: true },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
});

const Deposit = mongoose.model('Deposit', depositSchema);

export default Deposit;