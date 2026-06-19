import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const RegisterPage = () => {
    const [formData, setFormData] = useState({ full_name: '', email: '', password: '' });
    const [message, setMessage] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://localhost:5000/api/auth/register', formData);
            setMessage(res.data.message);
        } catch (error) {
            setMessage(error.response?.data?.message || 'Đăng ký thất bại');
        }
    };

    return (
        <div style={styles.container}>
            <form onSubmit={handleSubmit} style={styles.form}>
                <h2 style={styles.title}>Đăng Ký Tài Khoản</h2>
                {message && <p style={styles.alert}>{message}</p>}

                <div style={styles.inputGroup}>
                    <label>Họ và Tên:</label>
                    <input type="text" name="full_name" onChange={handleChange} required style={styles.input} />
                </div>

                <div style={styles.inputGroup}>
                    <label>Email:</label>
                    <input type="email" name="email" onChange={handleChange} required style={styles.input} />
                </div>

                <div style={styles.inputGroup}>
                    <label>Mật khẩu:</label>
                    <input type="password" name="password" onChange={handleChange} required style={styles.input} />
                </div>

                <button type="submit" style={styles.button}>Tạo Tài Khoản</button>

                <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#64748b' }}>
                    Đã có tài khoản? {' '}
                    <Link to="/login" style={{ color: '#1b2a4a', fontWeight: 'bold', textDecoration: 'none' }}>
                        Đăng nhập tại đây
                    </Link>
                </p>
            </form>
        </div>
    );
};

// Sử dụng chung object styles giống hệt bên trang Login để đồng bộ thiết kế cổ điển (Navy & Kem)
const styles = {
    container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f3f0df' },
    form: { background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', width: '400px' },
    title: { fontFamily: 'Merriweather, serif', color: '#1b2a4a', marginBottom: '20px', textAlign: 'center' },
    inputGroup: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
    input: { padding: '10px', marginTop: '5px', borderRadius: '6px', border: '1px solid #ccc' },
    button: { width: '100%', padding: '12px', backgroundColor: '#c9a84c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
    alert: { color: 'green', textAlign: 'center', marginBottom: '10px' }
};

export default RegisterPage;