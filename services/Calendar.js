const { Firestore } = require("@google-cloud/firestore");
const moment = require("moment-timezone");
const firestore = new Firestore();
const ical = require("ical-generator");
const uuid = require("uuid");

exports.createCalendar = async(calendar, counselorId) => {
    let doc = await firestore
        .collection("calendar")
        .doc(counselorId)
        .add(calendar);
    await doc.update({ id: doc.id });
    return doc;
};

exports.getCalendar = async(counselorId) => {
    return (await firestore.collection("calendar").doc(counselorId).get()).data();
};

exports.createEvent = async(event) => {
    return (
        await firestore
        .collection("calendar")
        .doc(event.counselorId)
        .collection("events")
        .add(event)
    ).get();
};

/**
 * @param {object} event
 * @returns {Promise} a promise of the send email method
 * @description create an ICS file for an event and sends it to a counselor's email
 */
exports.sendICSToCounsellor = async(event) => {
    const cal = ical({
        timezone: event.timeZone,
    });

    const attachment = {
        filename: "invite.ics",
        name: "invite.ics",
        content: Buffer.from(cal).toString("base64"),
        disposition: "attachment",
        contentId: uuid(),
        type: "text/calendar; method=REQUEST",
    };

    const html = await createEmailBody(
        "<p>Please find attached an invitation for a session by a user on imcroapp.com sent to you. The email contains information about this appointment.</p>"
    );
    const subject = `1 new notifications on oreon`;

    let emailBody = {
        to: event.counsellorEmail,
        from: config.notifyEmailFrom,
        subject,
        html,
        attachments: [attachment],
    };
};

/**
 *
 * @requires @param {string} counselorId
 * @requires @param {string} timeZone
 * @param {object} range
 * @param {number} index - index for pagination
 * @returns {DocumentData} data - collection of events
 * @description return an indexed array of events for a counselor for a specific time zone between an range or returns a sorted list of all events
 */
exports.getEvents = async(counselorId, timeZone, range, max) => {
    return (
        range && range.start ?
        await firestore
        .collection("calendar")
        .doc(counselorId)
        .collection("events")
        .where("start", ">=", moment(range.startDate).tz(timeZone))
        .where("start", "<=", moment(range.endDate).tz(timeZone))
        .limit(max)
        .get() :
        await firestore
        .collection("calendar")
        .doc(counselorId)
        .collection("events")
        .limit(max)
        .get()
    ).docs.map((doc) => doc.data());
};

/**
 *
 * @requires @param {string} eventId
 * @requires @param {string} timeZone
 * @returns {DocumentData} data - counselors event
 * @description return an object of the counselors event or null if the event does not exist.
 */
exports.getEvent = async(eventId, counselorId) => {
    return (
        await firestore
        .collection("calendar")
        .doc(counselorId)
        .collection("events")
        .doc(eventId)
        .get()
    ).data();
};