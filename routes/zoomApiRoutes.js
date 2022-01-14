const { Router } = require("express");
const moment = require("moment-timezone");
const ZoomApi = require("../services/ZoomAPI");
const GoogleEvent = require("../services/GoogleEvent.js");
const CounselorSetting = require("../services/CounselorSetting.js");
const config = require("../config");
const router = new Router();
const calendar = new GoogleEvent();

const checkAccessTokenExpire = (expiresIn, updateAt) => {
    const currentTime = moment().unix();
    if (expiresIn + updateAt > currentTime) {
        return false; // not expired
    }
    return true; // expired
};

const getAccessToken = (req) => {
    const { token = "" } = req.headers;
    if (token) {
        return token;
    }
    const ztoken = req.session.ztoken;
    if (!ztoken) {
        return "";
    }
    const { access_token, expires_in, update_at } = JSON.parse(ztoken);
    const isExpired = checkAccessTokenExpire(expires_in, update_at);
    if (isExpired) {
        // clear ztoken on expires
        req.session.ztoken = JSON.stringify({});
        return "";
    }
    return access_token;
};

router.get("/meetings", async(req, res) => {
    try {
        const token = getAccessToken(req);
        const data = await ZoomApi.getMeetings(token);

        return res.json(data);
    } catch (err) {
        return res.status(err.response.status).json(err);
    }
});

router.get("/meetings/:id", async(req, res) => {
    try {
        const token = getAccessToken(req);
        const data = await ZoomApi.getMeeting(token, req.params.id);
        return res.json(data);
    } catch (err) {
        if (err.response.status == 401) {
            return res.json({
                login: 1,
            });
        } else if (err.response.status == 404 || err.response.status == 400) {
            return res.json({
                createNew: 1,
            });
        }
        return res.status(err.response.status).json(err);
    }
});

router.post("/calendar/available", async(req, res) => {
    try {
        // duration in minutes
        let { fromDate, timeZone, counselorId, id: meetingId, duration = 15 } = req.body;
        const available = await CounselorSetting.availableTime(
            fromDate,
            duration,
            timeZone,
            counselorId
        );
        const { avFromTime, avToTime } = available;
        const events = await calendar.listEvents(
            avFromTime.toISOString(),
            avToTime.toISOString(),
            100
        );
        const lists = CounselorSetting.getListTimes({
            avFromTime,
            avToTime,
            duration,
            userTimeZone: timeZone,
            meetingId,
            events,
        });
        const data = {
            lists,
            avFromTime: avFromTime.toLocaleString(),
            avToTime: avToTime.toLocaleString(),
            events,
            available,
        };
        res.json(data);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "something went wrong" });
    }
});

router.post("/meetings", async(req, res) => {
    try {
        const token = getAccessToken(req);
        const { topic, start_time, duration } = req.body;
        const fromDate = start_time;
        const toDate = moment(start_time).add(duration, "minutes");
        // check working hours
        const available = await CounselorSetting.isAvailable(fromDate, toDate);
        if (available) {
            // check calendars
            const free = await calendar.freeBusy(fromDate, toDate);
            if (free) {
                const data = await ZoomApi.createMeeting(token, req.body);
                const { password, start_url, join_url } = data;
                const desc = `
                    Password: ${password}
                    Start Url: ${start_url}
                    Join Url: ${join_url}
                `;
                const event = GoogleEvent.createEventData({
                    topic,
                    start_time,
                    duration,
                    agenda: desc,
                    meetingId: data.id,
                });
                await calendar.addEvent(event);
                return res.json(data);
            }
        }
        return res.json({ notAvailable: 1 });
    } catch (err) {
        if (err.response.status == 401) {
            return res.json({
                login: 1,
            });
        } else if (err.response.status == 404 || err.response.status == 400) {
            return res.json({
                createNew: 1,
            });
        }
        return res.status(err.response.status).json(err);
    }
});

router.patch("/meetings/:id", async(req, res) => {
    try {
        const token = getAccessToken(req);
        const { start_time } = req.body;
        const meetingId = req.params.id;
        const fromDate = start_time;
        const meetingData = await ZoomApi.getMeeting(token, meetingId);
        const eventDataFromCalendar = await calendar.getEvent(meetingId);
        const { duration, topic, password, start_url, join_url } = meetingData;
        const toDate = moment(start_time).add(duration, "minutes");
        // check working hours
        const available = await CounselorSetting.isAvailable(fromDate, toDate);
        if (available) {
            // check calendars
            const events = await calendar.listEvents(fromDate, toDate);
            let free = true;
            if (events.items && events.items.length > 0) {
                events.items.forEach(
                    ({
                        id,
                        start: { dateTime: startDateTime },
                        end: { dateTime: endDateTime },
                    }) => {
                        if (
                            id != meetingId &&
                            moment(toDate).isBetween(startDateTime, endDateTime)
                        ) {
                            free = false;
                        }
                    }
                );
            }
            if (free) {
                await ZoomApi.editMeeting(token, req.params.id, req.body);
                const desc = `
        Password: ${password}
        Start Url: ${start_url}
        Join Url: ${join_url}
        `;
                const event = GoogleEvent.createEventData({
                    topic,
                    start_time,
                    duration,
                    agenda: desc,
                    meetingId,
                });
                if (eventDataFromCalendar.id) {
                    // update
                    await calendar.updateEvent(meetingId, event);
                } else {
                    // add new
                    await calendar.addEvent(event);
                }
                return res.json({
                    status: true,
                });
            }
        }
        return res.json({ notAvailable: 1 });
    } catch (err) {
        if (err.response.status == 401) {
            return res.json({
                login: 1,
            });
        } else if (err.response.status == 404 || err.response.status == 400) {
            return res.json({
                createNew: 1,
            });
        }
        return res.status(err.response.status).json(err);
    }
});

router.delete("/meetings/:id", async(req, res) => {
    try {
        const token = getAccessToken(req);
        const meetingId = req.params.id;
        const data = await ZoomApi.deleteMeeting(token, meetingId);
        await calendar.deleteEvent(meetingId);
        return res.json(data);
    } catch (err) {
        if (err.response.status == 401) {
            return res.json({
                login: 1,
            });
        } else if (err.response.status == 404 || err.response.status == 400) {
            return res.json({
                createNew: 1,
            });
        }
        return res.status(err.response.status).json(err);
    }
});

router.post("/meetings/:id/registrant", async(req, res) => {
    try {
        const token = getAccessToken(req);
        const data = await ZoomApi.addMeetingRegistrant(
            token,
            req.params.id,
            req.body
        );

        return res.json(data);
    } catch (err) {
        return res.status(err.response.status).json(err);
    }
});

router.get("/callback", (req, res) => {
    try {
        const token = ZoomApi.generateToken();

        return res.json({ token });
    } catch (err) {
        return res.status(err.response.status).json(err);
    }
});

router.post("/oauth/refreshtoken", async(req, res) => {
    try {
        const refreshToken = req.body.refreshToken;
        const data = await ZoomApi.refreshToken(refreshToken);

        return res.json(data);
    } catch (err) {
        return res.status(err.response.status).json(err);
    }
});

router.post("/oauth", async(req, res) => {
    try {
        const { access_token, expires_in, update_at } = req.session.ztoken ?
            JSON.parse(req.session.ztoken) : {};

        const token = getAccessToken(req);
        return res.json({
            auth: token ? 1 : 0,
            access_token,
            expires_in,
            update_at,
            token,
        });
    } catch (error) {
        console.log(error);
    }
});

router.post("/oauth/logout", async(req, res) => {
    try {
        req.session.ztoken = null;
        return res.json({
            success: 1,
        });
    } catch (error) {
        console.log(error);
        return res.json({
            fail: 1,
        });
    }
});

router.get("/oauth/callback", async(req, res) => {
    try {
        if (req.query.code) {
            const { access_token, refresh_token, expires_in } = await ZoomApi.oauth2(
                req.query.code
            );
            const ztoken = {
                access_token,
                refresh_token,
                expires_in,
                update_at: moment().unix(),
            };
            req.session.ztoken = JSON.stringify(ztoken);
            return res.redirect(`${config.appUrl}/zoom-oauth?code=${req.query.code}`);
        }

        // If no authorization code is available, redirect to Zoom OAuth to authorize
        res.redirect(
            `${config.zoomApiUrl}/authorize?response_type=code&client_id=${config.zoomApiOauthKey}&redirect_uri=${config.zoomApiOauthCallbackUrl}`
        );
    } catch (err) {
        console.log(err);
        return res.json({
            message: "Invalid code",
        });
    }
});

router.get("/oauth/logout", (req, res) => {
    return res.send("you are logged out");
});

module.exports = router;