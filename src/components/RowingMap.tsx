import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { LatLngExpression } from 'leaflet';
import type { GpsPoint } from '../types/rowing';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// LeafletのデフォルトアイコンがVite等のバンドラー経由で正しくロードされない問題の解決
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});


const FALLBACK_CENTER: LatLngExpression = [35.681236, 139.767125];

export interface RowingMapProps {
  gpsPoints: GpsPoint[];
  frameIndex: number;
}

const toLatLng = (point: GpsPoint): LatLngExpression => [point.latitude, point.longitude];

const nearestCurrentPoint = (gpsPoints: GpsPoint[], frameIndex: number): GpsPoint | null => {
  if (gpsPoints.length === 0) {
    return null;
  }

  let nearest = gpsPoints[0];
  let minDistance = Math.abs(gpsPoints[0].frameNumber - frameIndex);

  for (let i = 1; i < gpsPoints.length; i += 1) {
    const distance = Math.abs(gpsPoints[i].frameNumber - frameIndex);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = gpsPoints[i];
    }
  }

  return nearest;
};

// 軌跡全体が見えるよう、GPSデータが変わったときだけ一度フィットする。
// 毎フレーム再センタリングするとピンが常に中央に固定され、線上を動いて見えないため、
// フレーム変化（frameIndex）には反応させない。
function FitTrajectory({ path }: { path: LatLngExpression[] }) {
  const map = useMap();
  useEffect(() => {
    if (path.length === 0) {
      return;
    }
    if (path.length === 1) {
      map.setView(path[0], 19);
      return;
    }
    const bounds = L.latLngBounds(path as [number, number][]);
    if (!bounds.isValid()) {
      return;
    }
    // 全点が同一座標の場合は単一点になるので setView でフォールバック
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      map.setView(bounds.getCenter(), 19);
      return;
    }
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 19 });
  }, [path, map]);
  return null;
}

// コンテナサイズが変わった際に Leaflet へ通知し、タイル欠けを防ぐ
function MapInvalidator() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function RecenterButton({ center }: { center: LatLngExpression }) {
  const map = useMap();

  const handleRecenter = () => {
    // 現在のズームを保ったまま、現在のピン位置へパンする
    map.setView(center, map.getZoom());
  };

  return (
    <div
      className="leaflet-control"
      style={{
        position: 'absolute',
        top: '80px',
        left: '10px',
        zIndex: 1000,
        margin: 0,
        pointerEvents: 'auto',
      }}
    >
      <button
        onClick={handleRecenter}
        title="現在地に戻る"
        aria-label="現在地に戻る"
        style={{
          width: '34px',
          height: '34px',
          backgroundColor: '#ffffff',
          border: '1px solid rgba(0, 0, 0, 0.2)',
          borderRadius: '4px',
          outline: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#334155',
          boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
          transition: 'all 0.2s ease',
          padding: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#f1f5f9';
          e.currentTarget.style.color = '#0f172a';
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#ffffff';
          e.currentTarget.style.color = '#334155';
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <line x1="12" y1="1" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="23" />
          <line x1="1" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="23" y2="12" />
        </svg>
      </button>
    </div>
  );
}

function RowingMap({ gpsPoints, frameIndex }: RowingMapProps) {
  const path = useMemo(() => gpsPoints.map(toLatLng), [gpsPoints]);
  const currentPoint = useMemo(() => nearestCurrentPoint(gpsPoints, frameIndex), [gpsPoints, frameIndex]);
  const center = currentPoint ? toLatLng(currentPoint) : path[0] ?? FALLBACK_CENTER;

  if (gpsPoints.length === 0) {
    return (
      <section aria-label="GPSフォールバック" style={fallbackStyle}>
        <h3 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>GPS地図</h3>
        <p style={{ margin: 0, fontSize: '22px' }}>有効なGPSデータがないため、地図を表示できません。</p>
        <p style={{ margin: 0, fontSize: '22px' }}>緯度・経度の欠損値または (0,0) のみが検出されました。</p>
      </section>
    );
  }

  return (
    <section aria-label="ローイング地図" style={mapSectionStyle}>
      <MapContainer center={center} zoom={19} scrollWheelZoom style={mapStyle}>
        <MapInvalidator />
        <FitTrajectory path={path} />
        <RecenterButton center={center} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline color="#1769aa" positions={path} weight={4} />
        {currentPoint ? <Marker position={toLatLng(currentPoint)} /> : null}
      </MapContainer>
    </section>
  );
}

const mapSectionStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 0,
  display: 'flex',
};

const mapStyle: React.CSSProperties = {
  flex: 1,
  width: '100%',
  height: '100%',
  borderRadius: '8px',
};

const fallbackStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 0,
  border: '1px solid #c7c7c7',
  borderRadius: '8px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  textAlign: 'center',
  gap: '8px',
  background: '#f7f9fb',
  color: '#333',
  overflowWrap: 'anywhere',
  lineHeight: 1.4,
  fontSize: '22px',
};

export default RowingMap;
