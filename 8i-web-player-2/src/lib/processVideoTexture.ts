import * as THREE from "three";
import { MIME_TYPE_JPEG } from "./constants";

export const processVideoTexture = (video, mimeType = MIME_TYPE_JPEG, encoderOptions = 0.98) => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageURI = canvas.toDataURL(mimeType, encoderOptions);
      const image = new Image();
      image.src = imageURI;

      new THREE.TextureLoader().load(imageURI, resolve);
    } catch (e) {
      reject(e);
    }
  });
};
