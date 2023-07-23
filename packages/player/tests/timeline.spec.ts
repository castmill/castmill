/// <reference types="node" />

import { expect } from "chai";
import { describe, it } from "mocha";

import {
  SinonSpy,
  spy,
  createStubInstance,
  restore,
  useFakeTimers,
  stub,
  SinonFakeTimers,
} from "sinon";

// Add these interfaces for the child
interface TimelineBasicSpy extends TimelineBasic {
  play: SinonSpy;
  seek: SinonSpy;
  pause: SinonSpy;
}

interface TimelineItemSpy {
  start: number;
  duration: number;
  child: TimelineBasicSpy;
}

import {
  Timeline,
  TimelineBasic,
  TimelineItem,
} from "../src/widgets/template/timeline";

describe("Timeline", () => {
  let timeline: Timeline;

  beforeEach(() => {
    timeline = new Timeline("test");
  });

  it("should instantiate correctly", () => {
    expect(timeline).to.be.instanceOf(Timeline);
  });

  describe("add and remove", () => {
    let item: TimelineItem;

    beforeEach(() => {
      const child: TimelineBasic = {
        play: (offset: number): void => {},
        seek: (offset: number): void => {},
        pause: (): void => {},
        duration: () => 5000,
      };
      item = { child, start: 1000, duration: 5000 };
      timeline.add(item);
    });

    it("should add items correctly", () => {
      const addedItem = timeline.items.find(
        (i) =>
          i.child === item.child &&
          i.start === item.start &&
          i.duration === item.duration
      );
      expect(addedItem).to.exist;
    });

    it("should remove items correctly", () => {
      timeline.remove(item);
      expect(timeline.items).to.not.include(item);
    });
  });

  describe("play", () => {
    let clock: SinonFakeTimers;
    let item1: TimelineItemSpy, item2: TimelineItemSpy;

    beforeEach(() => {
      item1 = {
        start: 0,
        duration: 5000,
        child: {
          play: spy(),
          seek: spy(),
          pause: spy(),
          duration: () => 5000, //stub().returns(5000),
        },
      };
      item2 = {
        start: 3000,
        duration: 7000,
        child: {
          play: spy(),
          seek: spy(),
          pause: spy(),
          duration: () => 7000, //stub().returns(7000),
        },
      };
      timeline.add(item1);
      timeline.add(item2);

      // Stub Date.now and setInterval
      stub(Date, "now").returns(0);
      clock = useFakeTimers();
    });

    afterEach(() => {
      // Restore stubs after each test
      restore();
    });

    it("should play items correctly", async () => {
      expect(timeline.duration()).to.equal(10000);

      timeline.play(0);

      // Advance the fake timer to simulate setInterval
      clock.tick(100);

      expect(timeline.time).to.equal(100);

      expect(item1.child.play.calledOnce).to.be.true;
      expect(item2.child.play.called).to.be.false;

      clock.tick(2800);

      expect(timeline.time).to.equal(2900);

      expect(timeline.isPlaying(item1)).to.be.true;
      expect(timeline.isPlaying(item2)).to.be.false;

      expect(item1.child.play.calledOnce).to.be.true;
      expect(item2.child.play.calledOnce).to.be.false;

      clock.tick(100);

      expect(timeline.time).to.equal(3000);

      expect(timeline.isPlaying(item1)).to.be.true;
      expect(timeline.isPlaying(item2)).to.be.true;

      expect(item1.child.play.calledOnce).to.be.true;
      expect(item2.child.play.calledOnce).to.be.true;

      clock.tick(2000);

      expect(timeline.time).to.equal(5000);

      expect(timeline.isPlaying(item1)).to.be.false;
      expect(timeline.isPlaying(item2)).to.be.true;
    });

    it("should loop correctly", () => {
      timeline.setLoop(true);

      timeline.play(0);

      // Advance the fake timer to simulate setInterval
      // Assuming max duration is 7000 as per previous setup
      clock.tick(100);

      expect(item1.child.play.callCount).to.equal(1);
      expect(item2.child.play.callCount).to.equal(0);

      clock.tick(5000);

      expect(item1.child.play.callCount).to.equal(1);
      expect(item2.child.play.callCount).to.equal(1);

      clock.tick(4900);

      expect(item1.child.play.callCount).to.equal(2);
      expect(item2.child.play.callCount).to.equal(1);

      clock.tick(100);

      expect(item1.child.play.callCount).to.equal(2);
      expect(item2.child.play.callCount).to.equal(1);

      clock.tick(2900);

      expect(item1.child.play.callCount).to.equal(2);
      expect(item2.child.play.callCount).to.equal(2);
    });
  });

  describe("pause", () => {
    let item: TimelineItemSpy;
    let clock: SinonFakeTimers;

    beforeEach(() => {
      item = {
        start: 0,
        duration: 5000,
        child: {
          play: spy(),
          seek: spy(),
          pause: spy(),
          duration: stub().returns(5000),
        },
      };
      timeline.add(item);

      // Stub Date.now and setInterval
      stub(Date, "now").returns(0);
      clock = useFakeTimers();
    });

    afterEach(() => {
      // Restore stubs after each test
      restore();
    });

    it("should pause items correctly", () => {
      timeline.play(0);
      clock.tick(100); // Advance the clock by 100 ms
      timeline.pause();

      expect(item.child.pause.calledOnce).to.be.true;
    });
  });

  describe("seek", () => {
    let item: TimelineItemSpy;

    beforeEach(() => {
      item = {
        start: 0,
        duration: 5000,
        child: {
          play: spy(),
          seek: spy(),
          pause: spy(),
          duration: stub().returns(5000),
        },
      };
      timeline.add(item);
      timeline.seek(1000);
    });

    it("should seek items correctly", () => {
      expect(item.child.seek.calledWith(1000)).to.be.true;
    });
  });
});

describe("Timeline with child Timeline", () => {
  let timeline: Timeline;
  let childTimeline: Timeline;
  let childTimelineItem: TimelineItem;
  let item1: TimelineItemSpy;
  let item2: TimelineItemSpy;
  let item3: TimelineItemSpy;

  let clock: SinonFakeTimers;

  beforeEach(() => {
    timeline = new Timeline("test parent");
    childTimeline = new Timeline("test child");
    spy(childTimeline, "play");
    spy(childTimeline, "seek");
    spy(childTimeline, "pause");

    item1 = {
      start: 1000,
      duration: 2000,
      child: createStubInstance(Timeline),
    };
    item2 = {
      start: 4000,
      duration: 2000,
      child: createStubInstance(Timeline),
    };
    item3 = {
      start: 1000,
      duration: 3000,
      child: createStubInstance(Timeline),
    };

    childTimeline.add(item1);
    childTimeline.add(item2);
    childTimeline.add(item3);

    childTimelineItem = {
      start: 500,
      duration: 7000,
      child: childTimeline,
    };

    timeline.add(childTimelineItem);

    clock = useFakeTimers();
  });

  afterEach(() => {
    // Restore stubs after each test
    restore();
  });

  it("should add child timeline correctly", () => {
    expect(timeline.items[0].child).to.equal(childTimeline);

    expect(timeline.duration()).to.equal(7500);
  });

  it("should play items in child timeline correctly", () => {
    timeline.play(0);

    clock.tick(500);
    expect(item1.child.play.notCalled).to.be.true;
    expect(item2.child.play.notCalled).to.be.true;
    expect(item3.child.play.notCalled).to.be.true;

    expect((childTimeline.play as SinonSpy).calledOnce).to.be.true;

    clock.tick(500);
    expect(item1.child.play.notCalled).to.be.true;
    expect(item2.child.play.notCalled).to.be.true;
    expect(item3.child.play.notCalled).to.be.true;

    clock.tick(500);
    expect(item1.child.play.calledOnce).to.be.true;
    expect(item2.child.play.notCalled).to.be.true;
    expect(item3.child.play.calledOnce).to.be.true;

    expect(childTimeline.isPlaying(item1)).to.be.true;
    expect(childTimeline.isPlaying(item2)).to.be.false;
    expect(childTimeline.isPlaying(item3)).to.be.true;
    expect(timeline.isPlaying(childTimelineItem)).to.be.true;

    clock.tick(2000);

    clock.tick(999);
    expect(item1.child.play.calledOnce).to.be.true;
    expect(item2.child.play.notCalled).to.be.true;

    expect(childTimeline.isPlaying(item1)).to.be.false;
    expect(childTimeline.isPlaying(item2)).to.be.false;
    expect(childTimeline.isPlaying(item3)).to.be.true;

    clock.tick(1);
    expect(item1.child.play.calledOnce).to.be.true;
    expect(item2.child.play.calledOnce).to.be.true;

    expect(childTimeline.isPlaying(item2)).to.be.true;
    expect(childTimeline.isPlaying(item3)).to.be.false;
  });

  it("should pause items in child timeline correctly", () => {
    timeline.play(0);

    clock.tick(1500);
    timeline.pause();
    expect(item1.child.pause.calledOnce).to.be.true;
  });

  it("should seek items in child timeline correctly", () => {
    timeline.seek(1500); // Seeking into childTimeline's item1
    expect((childTimeline.seek as SinonSpy).getCall(0).args).to.deep.equal([
      1000,
    ]);
    expect((item1.child.seek as SinonSpy).getCall(0).args).to.deep.equal([0]);

    timeline.seek(3500); // Seeking into childTimeline's item2
    expect((item1.child.seek as SinonSpy).getCall(1).args).to.deep.equal([
      2000,
    ]);

    timeline.seek(4500); // Seeking into childTimeline's item2
    expect((childTimeline.seek as SinonSpy).getCall(2).args).to.deep.equal([
      4000,
    ]);
    expect((item2.child.seek as SinonSpy).getCall(0).args).to.deep.equal([0]);

    timeline.seek(6500); // Seeking into childTimeline's item3
    expect((childTimeline.seek as SinonSpy).getCall(3).args).to.deep.equal([
      6000,
    ]);
    expect((item3.child.seek as SinonSpy).getCall(0).args).to.deep.equal([0]);
  });
});
