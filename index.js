const session = require("express-session");
const FirestoreStore = require("firestore-store")(session);

const admin = require("firebase-admin");
admin.initializeApp();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const routes = require("./routes");
const config = require("./config");

const app = express();
//add origin to allow request from any origin. Advisable to specify origins requests can be received from
app.options(
    "*",
    cors({
        origin: true,
    })
);
app.set("trust proxy", 1);
app.use(
    session({
        store: new FirestoreStore({
            database: admin.firestore(),
        }),
        name: "__session",
        secret: "NUCmWgta4bNMeWbpGEUD5Oow",
        resave: true,
        saveUninitialized: true,
        cookie: {
            secure: true,
            httpOnly: true,
        },
    })
);

app.use(bodyParser.json({ limit: 1024 * 1024 * 40 }));
app.use(bodyParser.urlencoded({ extended: true, limit: 1024 * 1024 * 40 }));
//add origin to allow request from any origin. Advisable to specify origins requests can be received from
app.use(
    cors({
        origin: true,
    })
);
app.use((req, res, next) => {
    res.header("Cache-Control", "private");
    next();
});

const apiUrl = config.mode ? "/api" : "/";
app.use(apiUrl, routes);