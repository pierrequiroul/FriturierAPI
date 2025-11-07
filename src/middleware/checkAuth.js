const jwt = require('jsonwebtoken');

const checkAuth = (req, res, next) => {
    // Autoriser les requêtes OPTIONS pour CORS
    if (req.method === 'OPTIONS') {
        return next();
    }

    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            throw new Error('Authentification requise');
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        req.userData = { authenticated: true };
        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Authentification échouée',
            error: error.message
        });
    }
};

module.exports = checkAuth;