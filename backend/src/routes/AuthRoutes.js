import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js'; 

const router = express.Router();

// 1. API ĐĂNG KÝ (REGISTER)
router.post('/register', async (req, res) => {
    try {
        const { full_name, email, password } = req.body;

        // Kiểm tra xem email đã tồn tại chưa
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'Email này đã được sử dụng!' });
        }

        // Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Tạo user mới (Map dữ liệu cho khớp với userSchema)
        user = new User({
            username: full_name, // Giao diện gửi full_name, DB lưu vào username
            email,
            password_hash,
            system_role: 'user',
            subscription_type: 'free' // Khớp với enum trong User.js
        });

        await user.save();
        res.status(201).json({ message: 'Đăng ký tài khoản thành công!' });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ!', error: error.message });
    }
});

// 2. API ĐĂNG NHẬP (LOGIN)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Tài khoản hoặc mật khẩu không chính xác!' });
        }

        // So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Tài khoản hoặc mật khẩu không chính xác!' });
        }

        // Tạo Token JWT
        const token = jwt.sign(
            { userId: user._id, role: user.system_role, tier: user.subscription_type },
            process.env.JWT_SECRET || 'SECRET_KEY_MAC_DINH',
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                full_name: user.username,
                email: user.email,
                tier: user.subscription_type,
                role: user.system_role
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Lỗi máy chủ!', error: error.message });
    }
});

export default router;