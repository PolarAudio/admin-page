// src/components/Login.jsx
import React, { useState, useEffect } from 'react';
import { auth } from '../firebase/init';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';

const Login = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                onLoginSuccess(user);
            }
        });
        return () => unsubscribe();
    }, [onLoginSuccess]);

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // onLoginSuccess will be called by the onAuthStateChanged listener
        } catch (err) {
            setError(err.message);
            console.error("Email login error:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            // onLoginSuccess will be called by the onAuthStateChanged listener
        } catch (err) {
            setError(err.message);
            console.error("Google login error:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md border border-gray-700">
                <h2 className="text-3xl font-bold text-orange-400 mb-6 text-center">Admin Login</h2>
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}
                <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                        <input
                            type="email"
                            id="email"
                            className="w-full p-3 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring focus:ring-orange-500"
                            placeholder="admin@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                        <input
                            type="password"
                            id="password"
                            className="w-full p-3 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring focus:ring-orange-500"
                            placeholder="********"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full py-3 bg-orange-600 text-white rounded-md font-semibold hover:bg-orange-700 transition duration-200"
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'Login with Email'}
                    </button>
                </form>
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-700"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-gray-800 text-gray-400">OR</span>
                    </div>
                </div>
                <button
                    onClick={handleGoogleLogin}
                    className="w-full py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition duration-200 flex items-center justify-center space-x-2"
                    disabled={loading}
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.0003 4.75C14.0003 4.75 15.7233 5.458 17.0353 6.728L20.0533 3.71C18.0003 1.778 15.2323 0.75 12.0003 0.75C7.90032 0.75 4.27132 3.001 2.38632 6.438L5.96332 9.298C6.85032 7.007 9.24932 5.458 12.0003 5.458V4.75Z" fill="#EA4335"/>
                        <path d="M23.25 12.0003C23.25 11.2013 23.181 10.4303 23.041 9.68832H12.0003V14.3113H18.4803C18.1833 15.8253 17.2493 17.1293 15.9013 18.0183L19.4783 20.8783C21.5003 19.0183 22.7503 16.3003 22.7503 12.0003H23.25Z" fill="#4285F4"/>
                        <path d="M5.96332 14.7013C5.72532 14.0093 5.58132 13.2653 5.58132 12.0003C5.58132 10.7353 5.72532 9.99132 5.96332 9.29932L2.38632 6.43832C0.865323 9.29932 0.000323303 10.9833 0.000323303 12.0003C0.000323303 13.0173 0.865323 14.7013 2.38632 17.5623L5.96332 14.7013Z" fill="#FBBC05"/>
                        <path d="M12.0003 23.25C15.2323 23.25 18.0003 22.222 20.0533 20.29L17.0353 17.272C15.7233 18.542 14.0003 19.25 12.0003 19.25C9.24932 19.25 6.85032 17.699 5.96332 15.408L2.38632 18.268C4.27132 21.705 7.90032 23.956 12.0003 23.956V23.25Z" fill="#34A853"/>
                    </svg>
                    <span>Login with Google</span>
                </button>
            </div>
        </div>
    );
};

export default Login;
