import { describe, it } from "mocha";
import { expect } from "chai";
import { Calendar } from "../src/classes/calendar";

describe("Calendar", () => {
  describe("#getPlaylistAt", () => {
    it("should return a playlist for a non-recurring entry within its time frame", function () {
      const calendar = new Calendar();
      calendar.entries = [
        {
          start: new Date("2023-08-10T11:00:00Z").getTime(),
          end: new Date("2023-08-12T15:00:00Z").getTime(),
          playlist_id: "playlist1",
          calendar_id: "calendar1",
          repeat_weekly_until: undefined,
        },
      ];

      const result = calendar.getPlaylistAt(
        new Date("2023-08-11T12:00:00Z").getTime()
      );
      expect(result).to.not.be.undefined;
      expect(result?.playlist).to.equal("playlist1");
    });

    it("should not return a playlist for a non-recurring entry outside its time frame", function () {
      const calendar = new Calendar();
      calendar.entries = [
        {
          start: new Date("2023-08-10T11:00:00Z").getTime(),
          end: new Date("2023-08-12T15:00:00Z").getTime(),
          playlist_id: "playlist2",
          calendar_id: "calendar2",
          repeat_weekly_until: undefined,
        },
      ];

      const result = calendar.getPlaylistAt(
        new Date("2023-08-10T10:59:59Z").getTime()
      );
      expect(result).to.be.undefined;
    });

    it("should not return a playlist for a recurring entry within its time frame but after repeat_weekly_until", function () {
      const calendar = new Calendar();
      calendar.entries = [
        {
          start: new Date("2023-08-10T11:00:00Z").getTime(),
          end: new Date("2023-08-12T15:00:00Z").getTime(),
          playlist_id: "playlist4",
          calendar_id: "calendar4",
          repeat_weekly_until: new Date("2023-08-24T00:00:00Z").getTime(),
        },
      ];

      const result = calendar.getPlaylistAt(
        new Date("2023-08-31T12:00:00Z").getTime()
      );
      expect(result).to.be.undefined;
    });

    it("should return a playlist for a recurring entry within its time frame but before repeat_weekly_until", function () {
      const calendar = new Calendar();
      calendar.entries = [
        {
          start: new Date("2023-08-10T11:00:00Z").getTime(),
          end: new Date("2023-08-12T15:00:00Z").getTime(),
          playlist_id: "playlist3",
          calendar_id: "calendar3",
          repeat_weekly_until: new Date("2023-09-12T00:00:00Z").getTime(),
        },
      ];

      const result = calendar.getPlaylistAt(
        new Date("2023-08-24T14:00:00Z").getTime()
      );
      expect(result).to.not.be.undefined;
      expect(result?.playlist).to.equal("playlist3");
    });

    it("should correctly return the nextTime field", function () {
      const calendar = new Calendar();
      calendar.entries = [
        {
          start: new Date("2023-08-10T11:00:00Z").getTime(),
          end: new Date("2023-08-12T15:00:00Z").getTime(),
          playlist_id: "playlist5",
          calendar_id: "calendar5",
          repeat_weekly_until: undefined,
        },
        {
          start: new Date("2023-08-12T16:00:00Z").getTime(),
          end: new Date("2023-08-14T10:00:00Z").getTime(),
          playlist_id: "playlist6",
          calendar_id: "calendar6",
          repeat_weekly_until: undefined,
        },
      ];

      const result = calendar.getPlaylistAt(
        new Date("2023-08-11T12:00:00Z").getTime()
      );
      expect(result).to.not.be.undefined;
      expect(result?.playlist).to.equal("playlist5");
      expect(result?.nextTime).to.equal(
        new Date("2023-08-12T16:00:00Z").getTime()
      );
    });

    it("should not return a playlist for a timestamp outside the defined time range, even within repeat_weekly_until", () => {
      const calendar = new Calendar();

      calendar.entries = [
        {
          start: new Date("2023-08-14T10:00:00Z").getTime(),
          end: new Date("2023-08-16T14:00:00Z").getTime(),
          playlist_id: "testPlaylist",
          calendar_id: "testCalendar",
          repeat_weekly_until: new Date("2023-08-28T00:00:00Z").getTime(),
        },
      ];

      const result = calendar.getPlaylistAt(
        new Date("2023-08-17T11:00:00Z").getTime()
      );

      expect(result).to.be.undefined;
    });

    it("should not return a playlist for a Thursday timestamp in the second week, even within repeat_weekly_until", () => {
      const calendar = new Calendar();

      calendar.entries = [
        {
          start: new Date("2023-08-14T10:00:00Z").getTime(),
          end: new Date("2023-08-16T14:00:00Z").getTime(),
          playlist_id: "testPlaylist2",
          calendar_id: "testCalendar2",
          repeat_weekly_until: new Date("2023-09-04T00:00:00Z").getTime(), // 3 weeks later
        },
      ];

      const result = calendar.getPlaylistAt(
        new Date("2023-08-24T11:00:00Z").getTime()
      ); // Thursday of second week

      expect(result).to.be.undefined;
    });

    it("should return a playlist for a Tuesday timestamp in the second week within repeat_weekly_until", () => {
      const calendar = new Calendar();

      calendar.entries = [
        {
          start: new Date("2023-08-14T10:00:00Z").getTime(),
          end: new Date("2023-08-16T14:00:00Z").getTime(),
          playlist_id: "testPlaylist3",
          calendar_id: "testCalendar3",
          repeat_weekly_until: new Date("2023-09-04T00:00:00Z").getTime(),
        },
      ];

      const result = calendar.getPlaylistAt(
        new Date("2023-08-22T11:00:00Z").getTime()
      ); // Tuesday of the second week

      expect(result).to.not.be.undefined;
      expect(result?.playlist).to.equal("testPlaylist3");
    });

    it("should not return a playlist for a Sunday timestamp in the second week, even within repeat_weekly_until", () => {
      const calendar = new Calendar();

      calendar.entries = [
        {
          start: new Date("2023-08-14T10:00:00Z").getTime(),
          end: new Date("2023-08-16T14:00:00Z").getTime(),
          playlist_id: "testPlaylist4",
          calendar_id: "testCalendar4",
          repeat_weekly_until: new Date("2023-09-04T00:00:00Z").getTime(),
        },
      ];

      const result = calendar.getPlaylistAt(
        new Date("2023-08-20T11:00:00Z").getTime()
      ); // Sunday of the second week

      expect(result).to.be.undefined;
    });
  });
});
