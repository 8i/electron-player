export function seekVideoTo(videoElement, targetTime, timeout = 5000, threshold = 0.1) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    // Function to check if the current time is close to the target time
    const checkTime = () => {
      if (Math.abs(videoElement.currentTime - targetTime) <= threshold) {
        videoElement.removeEventListener("seeked", onSeeked);
        resolve();
      } else if (Date.now() - startTime >= timeout) {
        videoElement.removeEventListener("seeked", onSeeked);
        reject(new Error("Seek operation timed out."));
      }
    };

    // Event listener for the 'seeked' event
    const onSeeked = () => {
      checkTime();
    };

    // If the video is already close to the target time, resolve immediately
    if (Math.abs(videoElement.currentTime - targetTime) <= threshold) {
      resolve();
      return;
    }

    // Start seeking to the target time
    videoElement.currentTime = targetTime;

    // Add event listener for 'seeked'
    videoElement.addEventListener("seeked", onSeeked);

    // Additionally, use a polling interval to check for timeout
    const intervalId = setInterval(() => {
      checkTime();
      if (Date.now() - startTime >= timeout) {
        clearInterval(intervalId);
        videoElement.removeEventListener("seeked", onSeeked);
        reject(new Error("Seek operation timed out."));
      }
    }, 100);
  });
}
