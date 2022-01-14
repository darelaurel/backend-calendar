const zoomApiConfig = {
    zoomApiUrl: "https://zoom.us/oauth",
    zoomApiJwtKey: "4Osedrezpmnnyzqsq",
    zoomApiJwtSecret: "83kfqszqerstdgyreB",
    zoomApiOauthKey: "Ovtsmkjheqdtyfzagyqs",
    zoomApiOauthSecret: "hnGTo0WudSeOtkoalzerfuedsZuuerf",
    zoomApiOauthCallbackUrl: "https://localhost:5000/api/zoom/oauth/callback",
};

module.exports = {
    mode: "development",
    ...zoomApiConfig,
    notifyEmailTo: "dsmsmart@gmail.com",
    //notifyEmailCC: "info@amaze.website",
    notifyEmailFrom: "info@oreeon.com",
};