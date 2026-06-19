import React, { useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const LoginPage = () => {
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };
    const navigate = useNavigate();
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:5000/api/auth/login', formData);
            localStorage.setItem('userToken', res.data.token); // Lưu token lại để dùng sau
            setMessage(`Chào mừng ${res.data.user.full_name} đã đăng nhập thành công!`);
            navigate('/dashboard'); // Điều hướng sang trang chủ sau khi đăng nhập thành công
        } catch (error) {
            setMessage(error.response?.data?.message || 'Đăng nhập thất bại');
        }
    };

    return (
        <div style={styles.container}>
            <form onSubmit={handleSubmit} style={styles.form}>
                <h2 style={styles.title}>Đăng Nhập Phiên Tòa</h2>
                {message && <p style={styles.alert}>{message}</p>}

                <div style={styles.inputGroup}>
                    <label>Email:</label>
                    <input type="email" name="email" onChange={handleChange} required style={styles.input} />
                </div>

                <div style={styles.inputGroup}>
                    <label>Mật khẩu:</label>
                    <input type="password" name="password" onChange={handleChange} required style={styles.input} />
                </div>

                <button type="submit" style={styles.button}>Vào Phiên Tòa</button>

                <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#64748b' }}>
                    Bạn chưa có tài khoản? {' '}
                    <Link to="/register" style={{ color: '#c9a84c', fontWeight: 'bold', textDecoration: 'none' }}>
                        Đăng ký ngay
                    </Link>
                </p>
            </form>
        </div>
    );

};

const styles = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f0df' },
    form: { background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '400px' },
    title: { fontFamily: 'Merriweather, serif', color: '#1b2a4a', marginBottom: '20px', textAlign: 'center' },
    inputGroup: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
    input: { padding: '10px', marginTop: '5px', borderRadius: '6px', border: '1px solid #ccc' },
    button: { width: '100%', padding: '12px', backgroundColor: '#1b2a4a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }, alert: { color: 'red', textAlign: 'center', marginBottom: '10px' }
};

export default LoginPage;