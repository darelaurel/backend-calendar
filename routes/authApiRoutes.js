const { Router } = require('express');
const admin = require('firebase-admin');
const router = new Router();
const config = require('../config');
const additionalClaims = {
    premiumAccount: true,
};

/***
 * Add custom claims Premium base on UID when Admin logs as User
 * only Admin can logs as User bacause he don't have his credentials 
 */
router.post('/token', async(req, res) => {
    try {
        const idToken = req.headers.token;
        const loginAsUserId = req.body.userId;
        // verify token and make sure current user is a admin
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        if (!uid || !loginAsUserId || uid !== config.adminUID) {
            throw new Error('Invalid request.');
        }
        const customUserToken = await admin
            .auth()
            .createCustomToken(loginAsUserId, additionalClaims);

        return res.json({ customUserToken });
    } catch (err) {
        console.log(err);
        return res.status(500).send('Something went wrong.');
    }
});

module.exports = router;