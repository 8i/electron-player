export const isTimeWithinBuffered = (buffered, time, bufferTime = 0) => {
  for (let i = 0, start = 0, end = 0; i < buffered.length; i++) {
    start = buffered.start(i);
    end = buffered.end(i);

    if (time >= start - bufferTime && time <= end + bufferTime) {
      return true;
    }
  }
  return false;
};
