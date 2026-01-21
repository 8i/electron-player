export class WorkerPool {
  numWorkers = 1;
  workers: Worker[] = [];
  currentIndex = 0;

  constructor(numWorkers: number) {
    if (typeof numWorkers === "number") {
      if (numWorkers < 1) {
        throw new Error("numWorkers must be greater than 0");
      }
      this.numWorkers = numWorkers;
    }
    this.setupWorkers();
  }

  setupWorkers() {
    const { workers, numWorkers } = this;
    for (let i = 0; i < numWorkers; ++i) {
      const worker = new Worker(new URL("../dash/DecodeWorker.ts", import.meta.url), {
        type: "module",
      });
      workers.push(worker);
      worker.onmessage = this.onWorkerMessage;
      worker.onerror = this.onWorkerError;
    }
  }

  postMessage(message, transfer) {
    const { currentIndex, numWorkers, workers } = this;
    const worker = workers[currentIndex];
    worker.postMessage(message, transfer);

    const nextIndex = (currentIndex + 1) % numWorkers;
    this.currentIndex = nextIndex;
  }

  onWorkerMessage = (e) => {
    this.onmessage(e);
  };

  onWorkerError = (e) => {
    this.onerror(e);
  };
}
