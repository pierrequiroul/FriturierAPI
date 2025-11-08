const jwt = require('jsonwebtoken');

/**
 * Middleware d'authentification flexible.
 * Autorise soit :
 * - un header Authorization: Bearer <JWT>
 * - ou un header x-api-key égal à la variable d'environnement STATS_API_KEY
 */
const checkAuth = (req, res, next) => {
    // Autoriser les requêtes OPTIONS pour CORS
    if (req.method === 'OPTIONS') {
        return next();
    }

    try {
        // 1) Vérifier la clé API en priorité (utile pour les bots/serveurs)
        const providedApiKey = req.headers['x-api-key'] || req.headers['X-API-KEY'];
        const expectedApiKey = process.env.STATS_API_KEY;

        if (expectedApiKey && providedApiKey && providedApiKey === expectedApiKey) {
            req.userData = { authenticated: true, via: 'api-key' };
            return next();
        }

        // 2) Sinon vérifier le JWT dans Authorization
        const authHeader = req.headers.authorization || req.headers.Authorization;
        const token = authHeader ? authHeader.split(' ')[1] : null;

        if (!token) {
            throw new Error('Authentification requise');
        }

        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        req.userData = { authenticated: true, via: 'jwt', sub: decodedToken.sub };
        return next();
    } catch (error) {
        return res.status(401).json({
            message: 'Authentification échouée',
            error: error.message
        });
    }
};

module.exports = checkAuth;