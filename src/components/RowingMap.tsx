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

function ChangeView({ center }: { center: LatLngExpression }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [center, map]);
  return null;
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
        <ChangeView center={center} />
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
