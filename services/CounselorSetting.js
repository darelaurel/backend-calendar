const { Firestore } = require("@google-cloud/firestore");
const moment = require("moment-timezone");
const firestore = new Firestore();
const DAYS = {
    0: "sun",
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
    6: "sat",
};
class UserSetting {
    /**
     * return availables hours of Counselor
     **/
    static async getAvailableHours(counselorId) {
        return new Promise((resolve, reject) => {
            firestore
                .collection("counselors_settings")
                .doc(counselorId)
                .get()
                .then(function(docs) {
                    if (docs.data()) {
                        resolve(docs.data());
                    } else {
                        reject(false);
                    }
                })
                .catch((e) => {
                    console.log(e);
                    return reject(false);
                });
        });
    }

    /**
     * Check if the fromDate and toDate of booking is available
     * on Counselor day calendar
     **/
    static async isAvailable(fromDate, toDate) {
        const timeZone = "Africa/Porto-Novo";
        fromDate = moment(fromDate).tz(timeZone);
        toDate = moment(toDate).tz(timeZone);

        //get day of week of fromDate
        const dayOfWeek = moment(fromDate).tz(timeZone).day();

        const availableHours = await UserSetting.getAvailableHours();

        //return avaialable Time of Counsolor for the day
        let availableTime = availableHours[DAYS[dayOfWeek]];

        if (!availableTime) {
            //const defaultAvailableHours = UserSetting.getDefaultAvailableHours();
            //availableTime = defaultAvailableHours[DAYS[dayOfWeek]];
            return false;
        }
        const { from, to } = availableTime;

        const fromTime = moment(from, "HH:mm");
        const avFromTime = moment(fromDate).set({
            hour: fromTime.get("hour"),
            minute: fromTime.get("minute"),
        });
        const toTime = moment(to, "HH:mm");
        const avToTime = moment(toDate).set({
            hour: toTime.get("hour"),
            minute: toTime.get("minute"),
        });
        const fromDateBetween = moment(fromDate).isBetween(
            avFromTime,
            avToTime,
            undefined,
            "[]"
        );
        const toDateBetween = moment(toDate).isBetween(
            avFromTime,
            avToTime,
            undefined,
            "[]"
        );

        return fromDateBetween && toDateBetween;
    }

    static async availableTime(fromD, duration, timeZone, counselorId) {
        /**
         * fromDate is a ISO string - UTC
         */
        let fromDate = moment(fromD).tz(timeZone);

        const toDate = moment(fromDate).add(duration, "minutes").tz(timeZone);
        const dayOfWeek = fromDate.day();

        const availableHours = await UserSetting.getAvailableHours(counselorId);

        let availableTime = availableHours[DAYS[dayOfWeek]][0];
        console.log(availableTime);

        if (!availableTime) {
            //const defaultAvailableHours = UserSetting.getDefaultAvailableHours();
            //availableTime = defaultAvailableHours[DAYS[dayOfWeek]];
            //return false;
            return availableHours;
        }

        const { from, to } = availableTime;
        const fromTime = moment(from, "HH:mm").tz(timeZone);
        let hour = fromTime.get("hour");
        let minute = fromTime.get("minute");
        const currentTime = moment().tz(timeZone).add(60, "minutes");
        let avFromTime = moment(fromDate).set({
            hour,
            minute,
        });
        while (avFromTime.isSameOrBefore(currentTime)) {
            avFromTime = avFromTime.add(duration, "minutes");
        }

        const toTime = moment(to, "HH:mm");
        const avToTime = moment(toDate).set({
            hour: toTime.get("hour"),
            minute: toTime.get("minute"),
        });
        return {
            avFromTime,
            avToTime,
        };
    }

    static async availableTimes(fromD, duration, timeZone, counselorId) {
        /**
         * fromDate is a ISO string - UTC
         */
        let fromDate = moment(fromD).tz(timeZone);
        let times = [];

        const dayOfWeek = fromDate.day();

        const userSettings = await UserSetting.getAvailableHours(counselorId);

        const availableHours = userSettings.availableHours;

        let availableTime = availableHours[DAYS[dayOfWeek]][0];

        const { from, to } = availableTime;
        let fromTime = moment(fromDate)
            .set({
                hour: moment(from).hour,
                minute: moment(from).minute,
            })
            .tz(userSettings.timezone.name, true);
        let hour = fromTime.get("hour");
        let minute = fromTime.get("minute");
        const currentTime = moment().tz(userSettings.timezone.name);

        console.log(fromTime, moment(to, "HH:mm"));

        // if available date is the same as the current date and after then set the fromTime to current time
        if (
            currentTime.isSame(fromTime, "day") &&
            currentTime.isAfter(fromTime, "minutes")
        ) {
            fromTime = currentTime.set({ minute });
            hour = currentTime.hour;
        }

        let avFromTime = moment(fromTime).set({
            hour,
            minute,
        });

        const toTime = moment(to)
            .set({ day: fromDate.day, month: fromDate.month, year: fromDate.year })
            .tz(userSettings.timezone.name, true);
        const avToTime = moment(toTime).set({
            hour: toTime.get("hour"),
            minute: toTime.get("minute"),
        });

        while (avFromTime.isSameOrBefore(avToTime)) {
            let t = { from: moment(avFromTime, "HH:mm").format() };
            avFromTime = avFromTime.add(duration, "minutes");
            t.to = moment(avFromTime, "HH:mm").format();
            times.push(t);
        }

        return times;
    }

    static getListTimes({
        avFromTime,
        avToTime,
        duration,
        userTimeZone,
        meetingId,
        events,
    }) {
        let ret = [];
        let nextTime = moment(avFromTime).tz(userTimeZone);
        let idx = 0;
        do {
            const free = UserSetting.verifyCalendar({
                timeSlot: nextTime,
                duration,
                meetingId,
                events,
            });
            if (free) {
                ret[idx++] = nextTime.format("HH:mm");
            }
            nextTime = nextTime.add(duration, "minutes");
        } while (nextTime.isBefore(avToTime));
        return ret;
    }

    static verifyCalendar({ timeSlot, meetingId, events, timeZone }) {
        let free = true;
        if (events.items && events.items.length > 0) {
            events.items.forEach(
                ({
                    id,
                    end: { dateTime: endDateTime },
                    start: { dateTime: startDateTime },
                }) => {
                    if (!meetingId || meetingId != id) {
                        startDateTime = moment(startDateTime).tz(timeZone);
                        endDateTime = moment(endDateTime).tz(timeZone);
                        timeSlot = moment(timeSlot).tz(timeZone);

                        if (
                            timeSlot.isBetween(startDateTime, endDateTime, undefined, "[]")
                        ) {
                            free = false;
                        }
                    }
                }
            );
        }
        return free;
    }
}

module.exports = UserSetting;