const axios = require("axios");
const jwt = require("jsonwebtoken");
const config = require("../config");

class ZoomAPI {
  baseurl = "https://api.zoom.us/v2";
  meetingUrl = "/users/me/meetings";
  nextPageToken = "";

  constructor() {
    this.http = axios.create({
      baseURL: this.baseurl,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  setToken(token) {
    this.http.defaults.headers["authorization"] = `Bearer ${token}`;
  }

  async getMeetings(token) {
    this.setToken(token);

    const response = await this.http.get(`${this.meetingUrl}?type=upcoming`);

    return response.data;
  }

  async getMeeting(token, id) {
    this.setToken(token);

    const response = await this.http.get(`/meetings/${id}`);

    return response.data;
  }

  async createMeeting(
    token,
    { topic, start_time, duration, password, agenda }
  ) {
    this.setToken(token);

    const response = await this.http.post(this.meetingUrl, {
      topic,
      type: 2,
      start_time,
      duration,
      timezone: "UTC",
      password,
      agenda,
      settings: {
        approval_type: 0,
        use_pmi: false,
        audio: "both",
        host_video: true,
        participant_video: true,
        join_before_host: false,
        registration_type: 2,
        registrants_email_notification: true,
      },
    });

    return response.data;
  }

  async editMeeting(
    token,
    id,
    { topic, start_time, duration, password, agenda }
  ) {
    this.setToken(token);

    const response = await this.http.patch(`/meetings/${id}`, {
      topic,
      type: 2,
      start_time,
      duration,
      timezone: "UTC",
      password,
      agenda,
      settings: {
        approval_type: 0,
        use_pmi: false,
        audio: "both",
        host_video: true,
        participant_video: true,
        join_before_host: false,
        registration_type: 2,
        registrants_email_notification: true,
      },
    });

    return response.data;
  }

  async deleteMeeting(token, id) {
    this.setToken(token);

    const response = await this.http.delete(`/meetings/${id}`);

    return response.data;
  }

  async addMeetingRegistrant(token, id, data) {
    this.setToken(token);

    const response = await this.http.post(`/meetings/${id}/registrants`, data);

    return response.data;
  }

  generateToken() {
    const payload = {
      iss: config.zoomApiJwtKey,
      exp: new Date().getTime(),
    };

    return jwt.sign(payload, config.zoomApiJwtSecret);
  }

  async oauth2(code) {
    const url = `${config.zoomApiUrl}/token?grant_type=authorization_code&code=${code}&redirect_uri=${config.zoomApiOauthCallbackUrl}`;
    const authorizationCode = this.getAuthorizationHeader();
    const response = await axios.post(
      url,
      {},
      {
        headers: {
          Authorization: `Basic ${authorizationCode}`,
        },
      }
    );

    return response.data;
  }
  getAuthorizationHeader() {
    return Buffer.from(
      config.zoomApiOauthKey + ":" + config.zoomApiOauthSecret
    ).toString("base64");
  }
  async refreshToken(token) {
    const url = `${config.zoomApiUrl}/token?grant_type=refresh_token&refresh_token=${token}`;
    const authorizationCode = this.getAuthorizationHeader();
    const response = await axios.post(
      url,
      {},
      {
        headers: {
          Authorization: `Basic ${authorizationCode}`,
        },
      }
    );

    return response.data;
  }
}

module.exports = new ZoomAPI();
