export const getPartialOverlappingBufferedRanges = (video1: HTMLVideoElement, video2: HTMLVideoElement): TimeRanges => {
  const buffered1 = video1.buffered;
  const buffered2 = video2.buffered;

  const partialOverlappingRanges: [number, number][] = [];

  // Iterate over each range in video1
  for (let i = 0; i < buffered1.length; i++) {
    const start1 = buffered1.start(i);
    const end1 = buffered1.end(i);

    // Iterate over each range in video2
    for (let j = 0; j < buffered2.length; j++) {
      const start2 = buffered2.start(j);
      const end2 = buffered2.end(j);

      // Calculate the overlapping range between the two
      const overlapStart = Math.max(start1, start2);
      const overlapEnd = Math.min(end1, end2);

      // Check if there's an actual overlap
      if (overlapStart < overlapEnd) {
        partialOverlappingRanges.push([overlapStart, overlapEnd]);
      }
    }
  }

  // Convert partialOverlappingRanges into a custom TimeRanges-like object
  return {
    length: partialOverlappingRanges.length,
    start: (index: number) => partialOverlappingRanges[index][0],
    end: (index: number) => partialOverlappingRanges[index][1],
  };
};
