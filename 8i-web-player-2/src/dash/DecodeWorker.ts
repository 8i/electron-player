import { decodeDracoSample } from "./decodeDracoSample";

self.onmessage = async (e: MessageEvent<any>) => {
  const samples = await decodeDracoSample(e.data);
  self.postMessage(samples || []);
};
