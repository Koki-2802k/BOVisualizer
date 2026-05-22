import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { DoubleSide, Euler, Group, Quaternion } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  buildPivotQuaternion,
  LEFT_OARLOCK,
  getOarFixedRotation,
  makeSensorQuaternion,
  RIGHT_OARLOCK,
  sensorQuaternionToThree,
} from "../utils/coordTransform";
import { WATER_SURFACE_Y } from "../scene/constants";
import type { RowingFrame } from "../types/rowing";

type SceneProps = {
  frames: RowingFrame[];
  frameIndex: number;
};

type LoadedModels = {
  boat: Group;
  leftOar: Group;
  rightOar: Group;
};

const INBOARD_OFFSET: [number, number, number] = [0, 0, 0];
const BOAT_FIXED_ROTATION = new Euler(0, 0, -Math.PI / 180, "XYZ");
const LEFT_OAR_HEIGHT_OFFSET = 0.0; // 左オールのブレード先端高さをオフセットするための定数（メートル単位）
const RIGHT_OAR_HEIGHT_OFFSET = -0.2; // 右オールのブレード先端高さをオフセットするための定数（メートル単位）
const OAR_OUTBOARD_LENGTH = 2.0; // オールロックからブレード先端までの長さ（メートル）


const MODEL_PATHS = {
  boat: `${import.meta.env.BASE_URL}data/models/boat/boat.gltf`,
  leftOar: `${import.meta.env.BASE_URL}data/models/left_oar/left_oar.gltf`,
  rightOar: `${import.meta.env.BASE_URL}data/models/right_oar/right_oar.gltf`,
};

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function loadModel(path: string): Promise<Group> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      path,
      (gltf) => resolve(gltf.scene),
      undefined,
      () => reject(new Error(`GLTF load failed: ${path}`)),
    );
  });
}

function SceneRig({ frames, frameIndex, models }: SceneProps & { models: LoadedModels }) {
  const boatRef = useRef<Group>(null);
  const leftPivotRef = useRef<Group>(null);
  const rightPivotRef = useRef<Group>(null);
  const previousBoatQuat = useRef<Quaternion | undefined>(undefined);
  const previousLeftQuat = useRef<Quaternion | undefined>(undefined);
  const previousRightQuat = useRef<Quaternion | undefined>(undefined);

  const clonedBoat = useMemo(() => models.boat.clone(true), [models.boat]);
  const clonedLeft = useMemo(() => models.leftOar.clone(true), [models.leftOar]);
  const clonedRight = useMemo(() => models.rightOar.clone(true), [models.rightOar]);

  useFrame(() => {
    if (!boatRef.current || !leftPivotRef.current || !rightPivotRef.current || frames.length === 0) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(frameIndex, frames.length - 1));
    const frame = frames[safeIndex];
    const boatErrDegZ = asNumber(frame.err_deg_boat_z);

    const boatQuaternion = sensorQuaternionToThree(
      makeSensorQuaternion(
        asNumber(frame.wb, 1),
        asNumber(frame.xb),
        asNumber(frame.yb),
        asNumber(frame.zb),
      ),
      previousBoatQuat.current,
    );

    const leftQuaternion = buildPivotQuaternion(
      makeSensorQuaternion(
        asNumber(frame.wol, 1),
        asNumber(frame.xol),
        asNumber(frame.yol),
        asNumber(frame.zol),
      ),
      asNumber(frame.err_deg_oar_left_z),
      "left",
      previousLeftQuat.current,
      boatErrDegZ,
    );

    const rightQuaternion = buildPivotQuaternion(
      makeSensorQuaternion(
        asNumber(frame.wor, 1),
        asNumber(frame.xor),
        asNumber(frame.yor),
        asNumber(frame.zor),
      ),
      asNumber(frame.err_deg_oar_right_z),
      "right",
      previousRightQuat.current,
      boatErrDegZ,
    );

    const boatCorrection = new Quaternion().setFromEuler(BOAT_FIXED_ROTATION);
    boatRef.current.quaternion.copy(boatCorrection.multiply(boatQuaternion));
    leftPivotRef.current.quaternion.copy(leftQuaternion);
    rightPivotRef.current.quaternion.copy(rightQuaternion);

    previousBoatQuat.current = boatQuaternion;
    previousLeftQuat.current = leftQuaternion;
    previousRightQuat.current = rightQuaternion;
  });

  return (
    <group ref={boatRef}>
      <primitive object={clonedBoat} />

      <group ref={leftPivotRef} position={LEFT_OARLOCK}>
        <group rotation={getOarFixedRotation("left")} position={INBOARD_OFFSET}>
          <group rotation={[LEFT_OAR_HEIGHT_OFFSET / OAR_OUTBOARD_LENGTH, 0, 0]}>
            <primitive object={clonedLeft} />
          </group>
        </group>
      </group>

      <group ref={rightPivotRef} position={RIGHT_OARLOCK}>
        <group rotation={getOarFixedRotation("right")} position={INBOARD_OFFSET}>
          <group rotation={[-RIGHT_OAR_HEIGHT_OFFSET / OAR_OUTBOARD_LENGTH, 0, 0]}>
            <primitive object={clonedRight} />
          </group>
        </group>
      </group>
    </group>
  );
}

export default function Scene({ frames, frameIndex }: SceneProps) {
  const [models, setModels] = useState<LoadedModels | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const safeFrameIndex = Number.isFinite(frameIndex) ? Math.max(0, Math.min(frameIndex, Math.max(frames.length - 1, 0))) : 0;

  useEffect(() => {
    let mounted = true;

    Promise.all([
      loadModel(MODEL_PATHS.boat),
      loadModel(MODEL_PATHS.leftOar),
      loadModel(MODEL_PATHS.rightOar),
    ])
      .then(([boat, leftOar, rightOar]) => {
        if (!mounted) return;
        setModels({ boat, leftOar, rightOar });
        setLoadError(null);
      })
      .catch((error: Error) => {
        if (!mounted) return;
        setLoadError(error.message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loadError) {
    return (
      <div
        role="alert"
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "1rem",
          gap: "8px",
          color: "#dc2626",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 600 }}>3D表示</h3>
        <p style={{ margin: 0, fontSize: "22px" }}>
          3Dモデルの読み込みに失敗しました: {loadError}
        </p>
      </div>
    );
  }

  if (!models) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "1rem",
          gap: "8px",
          color: "#475569",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 600 }}>3D表示</h3>
        <p style={{ margin: 0, fontSize: "22px" }}>3Dモデルを読み込み中です…</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 0 }}>
      <Canvas camera={{ position: [3, 2, 4], fov: 45 }}>
        <color attach="background" args={["#dceeff"]} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 8, 3]} intensity={1.2} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_SURFACE_Y, 0]} receiveShadow={false}>
          <planeGeometry args={[30, 100]} />
          <meshStandardMaterial
            color="#60a5fa"
            transparent
            opacity={0.3}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <SceneRig frames={frames} frameIndex={safeFrameIndex} models={models} />
        <OrbitControls enablePan enableRotate enableZoom />
      </Canvas>
    </div>
  );
}
