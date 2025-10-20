import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true // Coupon codes will be saved in uppercase
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 1,
        max: 100
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Coupon = mongoose.model('Coupon', couponSchema);

export default Coupon;