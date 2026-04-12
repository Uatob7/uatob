import { useEffect, useRef, useState, useMemo } from "react";

/* ─────────────────────────────────────────────
   GOOGLE MAP LOADER (your key injected)
──────────────────────────────────────────── */
function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve();

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=AIzaSyDlA6cGdLX-wHR3myN6jTmiwZqViUGwSig";
    script.async = true;
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

/* ─────────────────────────────────────────────
   POLYLINE DECODER
──────────────────────────────────────────── */
function decodePolyline(str) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coords = [];

  while (index < str.length) {
    let b, shift = 0, result = 0;

    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return coords;
}

/* ─────────────────────────────────────────────
   MAIN PAGE
──────────────────────────────────────────── */
export default function BookingMapPage({ bookingPayload }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  const path = useMemo(
    () => decodePolyline(bookingPayload?.polyline || ""),
    [bookingPayload?.polyline]
  );

  /* ─────────────────────────────────────────────
     INIT MAP + ROUTE
  ───────────────────────────────────────────── */
  useEffect(() => {
    if (!path.length) return;

    let polyline;

    loadGoogleMaps().then(() => {
      if (!mapRef.current) return;

      // Center map on first point
      mapInstance.current = new window.google.maps.Map(mapRef.current, {
        zoom: 13,
        center: path[0],
        disableDefaultUI: true,
        styles: [
          {
            featureType: "all",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });

      // Fit bounds
      const bounds = new window.google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(p));
      mapInstance.current.fitBounds(bounds);

      // Draw polyline
      polyline = new window.google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#16A34A",
        strokeOpacity: 1,
        strokeWeight: 4,
      });

      polyline.setMap(mapInstance.current);
    });

    return () => {
      if (polyline) polyline.setMap(null);
    };
  }, [path]);

  /* ─────────────────────────────────────────────
     UI
  ───────────────────────────────────────────── */
  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 10 }}>
        {bookingPayload?.pickup} → {bookingPayload?.dropoff}
      </h2>

      <p style={{ marginBottom: 12 }}>
        {bookingPayload?.miles} mi · {bookingPayload?.durationMin} min
      </p>

      {/* REAL MAP BACKGROUND */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "500px",
          borderRadius: "18px",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      />

      {/* fallback */}
      {!bookingPayload?.polyline && (
        <p style={{ color: "red", marginTop: 10 }}>
          No polyline found in bookingPayload
        </p>
      )}
    </div>
  );
}