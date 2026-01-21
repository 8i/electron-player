import * as THREE from "three";
import { LoadingManager } from "three";
import {
  DRACO_LIBRARY_PATH,
  SAMPLE_TYPE_FULL,
  SAMPLE_TYPE_DELTA,
  SAMPLE_TYPE_INTERPOLATED,
  ENTRY_INT_ARRAY,
  ENTRY_STRING,
  ENTRY_INT,
  // ENTRY_DOUBLE_ARRAY,
  // ERR_NOT_IMPLEMENTED,
} from "../lib/constants";
import { DRACOLoader } from "./DRACOLoader";

let dracoLoader = null;
export const ITEM_COUNT = 4;

export const decodeDracoSample = async (sample, loadingManager?: LoadingManager = THREE.DefaultLoadingManager) => {
  const { data, timescale, dts: sampleTimestamp } = sample;

  if (!dracoLoader) {
    dracoLoader = new DRACOLoader(loadingManager);
    dracoLoader.setDecoderPath(DRACO_LIBRARY_PATH);
  }

  const { defaultAttributeIDs, defaultAttributeTypes } = dracoLoader;

  // TODO: Decode body-tracking related fields only when head tracking is
  // enabled.

  const taskConfig = {
    attributeIDs: defaultAttributeIDs,
    attributeTypes: defaultAttributeTypes,
    metadataFields: {
      version: ENTRY_STRING,
      timestamp: ENTRY_INT_ARRAY,
      interpolatedFrames: ENTRY_INT_ARRAY,
      deltaFrames: ENTRY_INT_ARRAY,
      deltaIds: ENTRY_INT_ARRAY,
      deltaNormalIds: ENTRY_INT_ARRAY,
      weightsAtt: ENTRY_INT,
      bindingsAtt: ENTRY_INT,
      // headJoint: ENTRY_DOUBLE_ARRAY,
      // headJointIndex: ENTRY_INT,
      // neckJoint: ENTRY_DOUBLE_ARRAY,
      // neckJointIndex: ENTRY_INT,
      // NOSE: ENTRY_DOUBLE_ARRAY,
      // NOSE_INDEX: ENTRY_INT,
      // EYE_L: ENTRY_DOUBLE_ARRAY,
      // EYE_L_INDEX: ENTRY_INT,
      // EYE_R: ENTRY_DOUBLE_ARRAY,
      // EYE_R_INDEX: ENTRY_INT,
      // EAR_L: ENTRY_DOUBLE_ARRAY,
      // EAR_L_INDEX: ENTRY_INT,
      // EAR_R: ENTRY_DOUBLE_ARRAY,
      // EAR_R_INDEX: ENTRY_INT,
      // SHO_L: ENTRY_DOUBLE_ARRAY,
      // SHO_L_INDEX: ENTRY_INT,
      // SHO_R: ENTRY_DOUBLE_ARRAY,
      // SHO_R_INDEX: ENTRY_INT,
      // ELB_L: ENTRY_DOUBLE_ARRAY,
      // ELB_L_INDEX: ENTRY_INT,
      // ELB_R: ENTRY_DOUBLE_ARRAY,
      // ELB_R_INDEX: ENTRY_INT,
      // WRI_L: ENTRY_DOUBLE_ARRAY,
      // WRI_L_INDEX: ENTRY_INT,
      // WRI_R: ENTRY_DOUBLE_ARRAY,
      // WRI_R_INDEX: ENTRY_INT,
      // HIP_L: ENTRY_DOUBLE_ARRAY,
      // HIP_L_INDEX: ENTRY_INT,
      // HIP_R: ENTRY_DOUBLE_ARRAY,
      // HIP_R_INDEX: ENTRY_INT,
      // KNE_L: ENTRY_DOUBLE_ARRAY,
      // KNE_L_INDEX: ENTRY_INT,
      // KNE_R: ENTRY_DOUBLE_ARRAY,
      // KNE_R_INDEX: ENTRY_INT,
      // ANK_L: ENTRY_DOUBLE_ARRAY,
      // ANK_L_INDEX: ENTRY_INT,
      // ANK_R: ENTRY_DOUBLE_ARRAY,
      // ANK_R_INDEX: ENTRY_INT,
      // NECK: ENTRY_DOUBLE_ARRAY,
      // NECK_INDEX: ENTRY_INT,
      // HEAD: ENTRY_DOUBLE_ARRAY,
      // HEAD_INDEX: ENTRY_INT,
      // SPINE_H: ENTRY_DOUBLE_ARRAY,
      // SPINE_H_INDEX: ENTRY_INT,
      // SPINE_M: ENTRY_DOUBLE_ARRAY,
      // SPINE_M_INDEX: ENTRY_INT,
      // SPINE_L: ENTRY_DOUBLE_ARRAY,
      // SPINE_L_INDEX: ENTRY_INT,
      // HIP_M: ENTRY_DOUBLE_ARRAY,
      // HIP_M_INDEX: ENTRY_INT,
    },
    useUniqueIDs: false,
    vertexColorSpace: THREE.LinearSRGBColorSpace,
    isEncrypted: Boolean(sample.encrypted),
  };

  const geometry = await dracoLoader.decodeGeometry(data.buffer, taskConfig);

  const {
    metadata,
    metadata: { deltaIds, deltaNormalIds },
  } = geometry;
  if (!metadata.deltaFrames) {
    metadata.deltaFrames = [];
  }

  if (!metadata.interpolatedFrames) {
    metadata.interpolatedFrames = [];
  }

  const hasNormals = deltaNormalIds !== undefined && geometry.attributes[deltaNormalIds] !== undefined;

  const sampleCount = metadata.timestamp ? metadata.timestamp.length : 1;
  const samples = new Array(sampleCount);

  const duration = metadata.timestamp ? sample.duration / metadata.timestamp.length : sample.duration;

  let weightsAtt, bindingsAtt;

  for (let i = 0; i < sampleCount; i++) {
    const userData = {};
    const timestamp = metadata.timestamp !== undefined ? metadata.timestamp[i] : sampleTimestamp;

    // const headJointIndex = metadata.headJointIndex || metadata.HEAD_INDEX;
    // const neckJointIndex = metadata.neckJointIndex || metadata.NECK_INDEX;
    // const headJoint = metadata.headJoint || metadata.HEAD;
    // const neckJoint = metadata.neckJoint || metadata.NECK;

    // if (isDefined(headJointIndex)) {
    //   Object.assign(userData, {
    //     headJointIndex,
    //     headJoint: new THREE.Vector3(headJoint[i * 3], headJoint[i * 3 + 1], headJoint[i * 3 + 2]),
    //   });
    // }
    // if (isDefined(neckJointIndex)) {
    //   Object.assign(userData, {
    //     neckJointIndex,
    //     neckJoint: new THREE.Vector3(neckJoint[i * 3], neckJoint[i * 3 + 1], neckJoint[i * 3 + 2]),
    //   });
    // }

    if (i === 0) {
      geometry.userData = userData;
      const position = geometry.attributes.position;
      const size = position.count * ITEM_COUNT;
      if (geometry.attributes.weightsAtt) {
        weightsAtt = geometry.attributes.weightsAtt.clone();
      } else {
        weightsAtt = new THREE.BufferAttribute(new Float32Array(size), ITEM_COUNT);
        geometry.setAttribute("weightsAtt", weightsAtt);
      }
      if (geometry.attributes.bindingsAtt) {
        // we have to convert the Int32Array to a Float32Array due to GLSL attribute type limitations on iOS
        bindingsAtt = new THREE.BufferAttribute(Float32Array.from(geometry.attributes.bindingsAtt.array), ITEM_COUNT);
        geometry.setAttribute("bindingsAtt", bindingsAtt);
      } else {
        bindingsAtt = new THREE.BufferAttribute(new Float32Array(size), ITEM_COUNT);
        geometry.setAttribute("bindingsAtt", bindingsAtt);
      }
      samples[i] = {
        type: SAMPLE_TYPE_FULL,
        timescale,
        geometry,
        timestamp,
        duration,
      };
    } else {
      const geo = new THREE.BufferGeometry();
      geo.setIndex(geometry.index);
      geo.setAttribute("uv", geometry.attributes.uv.clone());
      geo.setAttribute("position", geometry.attributes.position.clone());
      if (geometry.attributes.normal) {
        geo.setAttribute("normal", geometry.attributes.normal.clone());
      }
      geo.setAttribute("weightsAtt", weightsAtt);
      geo.setAttribute("bindingsAtt", bindingsAtt);
      geo.userData = userData;
      samples[i] = { geometry: geo, timestamp, duration };
    }
  }

  // References to samples at different indices
  let sampleA = null;
  let sampleB = null;
  let sampleC = null;

  const { deltaFrames, interpolatedFrames } = metadata;

  for (const id of deltaFrames) {
    samples[id].type = SAMPLE_TYPE_DELTA;
  }

  for (const id of interpolatedFrames) {
    samples[id].type = SAMPLE_TYPE_INTERPOLATED;
  }

  // Loop to populate delta positions
  let deltaIdx = 0;
  let prevDeltas;

  let deltaNormalsIdx = 0;
  let prevNormals = null;

  for (let index = 0; index < samples.length; index++) {
    sampleA = samples[index];

    if (sampleA.type !== SAMPLE_TYPE_DELTA) {
      continue;
    }
    const deltaPositions = geometry.attributes[deltaIds[deltaIdx++]];
    if (prevDeltas) {
      const { count, itemSize } = sampleA.geometry.attributes.position;
      for (let i = 0; i < count * itemSize; i++) {
        deltaPositions.array[i] += prevDeltas.array[i];
      }
    }
    // store deltas as an attribute on this frame for later lookup
    sampleA.geometry.setAttribute(SAMPLE_TYPE_DELTA, deltaPositions);
    // Apply deltas to original position
    const { count, itemSize } = sampleA.geometry.attributes.position;
    for (let i = 0; i < count * itemSize; i++) {
      sampleA.geometry.attributes.position.array[i] += deltaPositions.array[i];
    }
    sampleA.geometry.attributes.position.needsUpdate = true;
    prevDeltas = deltaPositions;

    if (hasNormals) {
      const normalPositions = geometry.attributes[deltaNormalIds[deltaNormalsIdx++]];
      const { count, itemSize } = sampleA.geometry.attributes.normal;

      if (prevNormals) {
        for (let i = 0; i < count * itemSize; i++) {
          normalPositions.array[i] += prevNormals.array[i];
        }
      }
      sampleA.geometry.setAttribute("deltaNormal", normalPositions);
      for (let i = 0; i < count * itemSize; i++) {
        sampleA.geometry.attributes.normal.array[i] += normalPositions.array[i];
      }
      sampleA.geometry.attributes.normal.needsUpdate = true;
      prevNormals = normalPositions;
    }
  }

  // Loop to interpolate in between
  for (let index = 0; index < samples.length; index++) {
    sampleA = samples[index];

    if (sampleA.type === SAMPLE_TYPE_INTERPOLATED) {
      let forwardIndex = -1;
      let backwardIndex = -1;
      for (let i = index; i < samples.length; i++) {
        sampleB = samples[i];
        if (sampleB.type === SAMPLE_TYPE_DELTA) {
          forwardIndex = i;
          break;
        }
      }
      for (let i = index; i >= 0; i--) {
        sampleB = samples[i];
        if (sampleB.type === SAMPLE_TYPE_DELTA || sampleB.type === SAMPLE_TYPE_FULL) {
          backwardIndex = i;
          break;
        }
      }
      const v0 = index - backwardIndex;
      const v1 = forwardIndex - backwardIndex;
      const t = v0 / v1;

      sampleB = samples[backwardIndex];
      sampleC = samples[forwardIndex];

      if (sampleB.type === SAMPLE_TYPE_FULL) {
        const backwardPositions = sampleB.geometry.attributes.position;
        const forwardDeltas = sampleC.geometry.attributes.delta;
        const { count, itemSize } = backwardPositions;
        for (let i = 0; i < count * itemSize; i++) {
          sampleA.geometry.attributes.position.array[i] = backwardPositions.array[i] + t * forwardDeltas.array[i];
        }
        if (hasNormals) {
          const backwardNormals = sampleB.geometry.attributes.normal;
          const forwardDeltas = sampleC.geometry.attributes.deltaNormal;
          const { count, itemSize } = backwardNormals;
          for (let i = 0; i < count * itemSize; i++) {
            sampleA.geometry.attributes.normal.array[i] = backwardNormals.array[i] + t * forwardDeltas.array[i];
          }
        }
      } else {
        const firstPositions = samples[0].geometry.attributes.position;
        const backwardDeltas = sampleB.geometry.attributes.delta;
        const forwardDeltas = sampleC.geometry.attributes.delta;
        const { count, itemSize } = backwardDeltas;
        for (let i = 0; i < count * itemSize; i++) {
          sampleA.geometry.attributes.position.array[i] =
            firstPositions.array[i] + backwardDeltas.array[i] + t * (forwardDeltas.array[i] - backwardDeltas.array[i]);
        }
        if (hasNormals) {
          const backwardDeltas = sampleB.geometry.attributes.deltaNormal;
          const forwardDeltas = sampleC.geometry.attributes.deltaNormal;
          const { count, itemSize } = backwardDeltas;
          for (let i = 0; i < count * itemSize; i++) {
            sampleA.geometry.attributes.normal.array[i] =
              firstPositions.array[i] +
              backwardDeltas.array[i] +
              t * (forwardDeltas.array[i] - backwardDeltas.array[i]);
          }
        }
      }
      sampleA.geometry.attributes.position.needsUpdate = true;
    }
  }
  return samples;
};
