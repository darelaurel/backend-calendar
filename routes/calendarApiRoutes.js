const { Router } = require("express");
const router = new Router();
const moment = require("moment-timezone");
const { getEvents, getEvent, createEvent } = require("../services/Calendar");
const CounselorSetting = require("../services/CounselorSetting.js");

const admin = require("firebase-admin");

/**
 * Returns a counselor's events
 * @GET
 * @name /events
 * @param {string} counselorId
 * @param {string} timeZone
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {array} events - booked appointments
 * @description
 */
router.get("/events", async(req, res, next) => {
    try {
        const { counselorId, timeZone, startDate, endDate } = req.query;
        if (!counselorId)
            return res
                .status(403)
                .json({ message: "Please provide a valid counselor id." });

        const events = await getEvents(counselorId, timeZone, {
            range: { startDate, endDate },
        });

        return res.json(events || []);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error. Failed to get counselor events.",
        });
        next(error);
    }
});

/**
 * Returns a counselor's event
 * @GET
 * @name /events/:id
 * @param {string} counselorId
 * @param {string} timeZone
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {object} events - booked appointment
 * @description
 */
router.get("/events/:id", async(req, res, next) => {
    try {
        const { counselorId } = req.query;
        const { id } = req.params;
        if (!counselorId || !id)
            return res
                .status(403)
                .json({ message: "Please provide a valid event details." });

        const event = await getEvent(id, counselorId);

        if (!event)
            return res
                .status(403)
                .json({ message: "Event does not exist or has been removed." });

        return res.json(event);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error. Failed to get counselor events.",
        });
        next(error);
    }
});

router.post("/available", async(req, res, next) => {
    try {
        // duration in minutes
        let { fromDate, timeZone, counselorId, duration = 15 } = req.body;

        const available = await CounselorSetting.availableTimes(
            fromDate,
            duration,
            timeZone,
            counselorId
        );

        const { avFromTime, avToTime } = available;

        const events = await getEvents(counselorId, timeZone, {
            range: {
                fromDate: moment(fromDate).set({
                    hour: moment(avFromTime).hour,
                    minutes: moment(avFromTime).minute,
                }),
                toDate: moment(fromDate).set({
                    hour: moment(avToTime).hour,
                    minutes: moment(avToTime).minute,
                }),
            },
        });

        // const lists = CounselorSetting.getListTimes({
        //   avFromTime,
        //   avToTime,
        //   duration,
        //   userTimeZone: timeZone,
        //   events,
        // });
        const data = {
            // lists,
            avFromTime: moment(avFromTime).tz(timeZone),
            avToTime: moment(avToTime).tz(timeZone),
            events,
            available,
        };
        res.json(data);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error. Failed to get counselor availability.",
        });
        next(error);
    }
});

router.post("/appoint", async(req, res, next) => {
    try {
        let { fromDate, timeZone, userId, counselorId, duration } = req.body;

        const appointment = (
            await createEvent({
                fromDate: moment(fromDate).tz(timeZone, true).format(),
                toDate: moment(fromDate)
                    .add(duration, "minutes")
                    .tz(timeZone, true)
                    .format(),
                duration: Number(duration),
                userId,
                timeZone,
                counselorId,
                createdAt: admin.firestore.Timestamp.fromMillis(
                    new Date(moment().utc().valueOf())
                ),
                updatedAt: admin.firestore.Timestamp.fromMillis(
                    new Date(moment().utc().valueOf())
                ),
            })
        ).data;

        if (!appointment)
            return res.status(403).json({
                message: "Failed to create appointment.",
            });
        res.json(appointment);
    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Internal server error. Failed to create appointment.",
        });
        next(error);
    }
});

module.exports = router;