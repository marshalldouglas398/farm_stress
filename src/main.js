import L from "leaflet";
import "leaflet/dist/leaflet.css";
import countiesRaw from "./data/sc-counties.geojson?raw";

const counties = JSON.parse(countiesRaw.replace(/^[^{]*/, ""));

const map = L.map("map", {
  center: [33.8361, -81.1637],
  zoom: 7,
  minZoom: 6,
  maxZoom: 19,
  zoomControl: true,
  scrollWheelZoom: true,
});

const streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
});

const satelliteLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution:
      "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maxZoom: 19,
  },
);

satelliteLayer.addTo(map);

const countiesLayer = L.geoJSON(counties, {
  style: {
    color: "#ffffff",
    weight: 1.4,
    fillColor: "#2f7d4f",
    fillOpacity: 0.12,
  },
  onEachFeature(feature, layer) {
    layer.bindTooltip(`${feature.properties.NAME} County`, {
      sticky: true,
      direction: "top",
    });
  },
}).addTo(map);

const cityLayer = L.layerGroup(
  [
    ["Greenville", 34.8526, -82.394],
    ["Spartanburg", 34.9496, -81.932],
    ["Columbia", 34.0007, -81.0348],
    ["Charleston", 32.7765, -79.9311],
    ["Myrtle Beach", 33.6891, -78.8867],
  ].map(([name, lat, lon]) =>
    L.circleMarker([lat, lon], {
      radius: 5,
      color: "#ffffff",
      weight: 2,
      fillColor: "#111827",
      fillOpacity: 1,
    }).bindTooltip(name, {
      permanent: true,
      direction: "right",
      offset: [8, 0],
      className: "city-label",
    }),
  ),
).addTo(map);

L.control
  .layers(
    {
      Satellite: satelliteLayer,
      Streets: streetLayer,
    },
    {
      "County outlines": countiesLayer,
      Cities: cityLayer,
    },
    {
      collapsed: false,
      position: "topright",
    },
  )
  .addTo(map);

L.control.scale({ imperial: true, metric: true }).addTo(map);
map.fitBounds(countiesLayer.getBounds(), { padding: [20, 20] });
