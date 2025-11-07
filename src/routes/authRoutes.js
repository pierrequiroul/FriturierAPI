const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

router.post('/login', (req, res) => {
    console.log('Tentative de connexion reçue');
    
    const { password } = req.body;
    console.log('Mot de passe reçu:', password ? 'Oui' : 'Non');
    console.log('Mot de passe attendu:', process.env.DASHBOARD_PASSWORD ? 'Défini' : 'Non défini');

    // Vérifier le mot de passe
    if (password === process.env.DASHBOARD_PASSWORD) {
        console.log('Mot de passe correct');
        
        // Créer un token JWT
        const token = jwt.sign(
            { authenticated: true },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        console.log('Token généré');

        // Définir les options du cookie
        res.status(200)
           .json({
                message: 'Authentification réussie',
                token: token
            });
        console.log('Réponse envoyée avec succès');
    } else {
        console.log('Mot de passe incorrect');
        res.status(401).json({
            message: 'Mot de passe incorrect'
        });
    }
});

module.exports = router;