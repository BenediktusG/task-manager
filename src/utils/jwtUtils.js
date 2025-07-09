import jwt from 'jsonwebtoken';
import { v4 } from 'uuid';

const generateAccessToken = (userId) => {
    return jwt.sign(
        { userId: userId },
        process.env.JWT_ACCESS_SECRET,
        {  
            expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
            algorithm: 'HS256',
            jwtid: v4(),
        },
    );
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (error) {
        return null;
    }
};

export {
    generateAccessToken,
    verifyToken,
}