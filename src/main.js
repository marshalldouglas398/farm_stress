import L from "leaflet";
import "leaflet/dist/leaflet.css";
import countiesRaw from "./data/sc-counties.geojson?raw";

const counties = JSON.parse(countiesRaw.replace(/^[^{]*/, ""));
const droughtWmsUrl =
  "https://ndmcgeodata.unl.edu/cgi-bin/mapserv.exe?map=/ms4w/apps/usdm/map/usdm_current_wms.map";
const droughtCapabilitiesUrl = `${droughtWmsUrl}&SERVICE=WMS&VERSION=1.3.0&REQUEST=GetCapabilities`;
const rainfallWmsUrl =
  "https://mapservices.weather.noaa.gov/raster/services/obs/mrms_qpe/ImageServer/WMSServer";
const rainfallQueryUrl =
  "https://mapservices.weather.noaa.gov/raster/rest/services/obs/mrms_qpe/ImageServer/query?where=name%20LIKE%20%27conus_QPE_%25%27&outFields=name,idp_filedate,idp_validendtime&returnGeometry=false&f=pjson";
const rainfallLayers = {
  "1 hour": "mrms_qpe:rft_1hr",
  "3 hours": "mrms_qpe:rft_3hr",
  "6 hours": "mrms_qpe:rft_6hr",
  "12 hours": "mrms_qpe:rft_12hr",
  "24 hours": "mrms_qpe:rft_24hr",
  "48 hours": "mrms_qpe:rft_48hr",
  "72 hours": "mrms_qpe:rft_72hr",
};
const droughtToggle = document.querySelector("#drought-toggle");
const droughtOpacity = document.querySelector("#drought-opacity");
const droughtDate = document.querySelector("#drought-date");
const rainfallToggle = document.querySelector("#rainfall-toggle");
const rainfallOpacity = document.querySelector("#rainfall-opacity");
const rainfallAccumulation = document.querySelector("#rainfall-accumulation");
const rainfallDate = document.querySelector("#rainfall-date");

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

const droughtLayer = L.tileLayer
  .wms(droughtWmsUrl, {
    layers: "usdm_current",
    format: "image/png",
    transparent: true,
    version: "1.1.1",
    opacity: 0.78,
    attribution: "U.S. Drought Monitor: NDMC, NOAA, USDA",
    maxZoom: 19,
  })
  .addTo(map);

const rainfallLayer = L.tileLayer.wms(rainfallWmsUrl, {
  layers: rainfallLayers["24 hours"],
  format: "image/png",
  transparent: true,
  version: "1.3.0",
  opacity: 0.62,
  attribution: "MRMS QPE: NOAA/NWS",
  maxZoom: 19,
});

const countiesLayer = L.geoJSON(counties, {
  style: {
    color: "#111827",
    weight: 1,
    fillOpacity: 0,
    opacity: 0.62,
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
setupOverlayControls();
updateDroughtDate(droughtDate);
updateRainfallDate(rainfallDate);
map.fitBounds(countiesLayer.getBounds(), { padding: [20, 20] });

function setupOverlayControls() {
  for (const [label, layerName] of Object.entries(rainfallLayers)) {
    const option = document.createElement("option");
    option.value = layerName;
    option.textContent = label;
    option.selected = label === "24 hours";
    rainfallAccumulation.append(option);
  }

  droughtToggle.addEventListener("change", () => {
    if (droughtToggle.checked) {
      droughtLayer.addTo(map);
      return;
    }

    droughtLayer.remove();
  });

  rainfallToggle.addEventListener("change", () => {
    if (rainfallToggle.checked) {
      rainfallLayer.addTo(map);
      return;
    }

    rainfallLayer.remove();
  });

  droughtOpacity.addEventListener("input", () => {
    droughtLayer.setOpacity(Number(droughtOpacity.value) / 100);
  });

  rainfallOpacity.addEventListener("input", () => {
    rainfallLayer.setOpacity(Number(rainfallOpacity.value) / 100);
  });

  rainfallAccumulation.addEventListener("change", () => {
    rainfallLayer.setParams({ layers: rainfallAccumulation.value });
  });
}

async function updateDroughtDate(dateElement) {
  try {
    const response = await fetch(droughtCapabilitiesUrl);
    if (!response.ok) {
      throw new Error(`USDM capabilities request failed: ${response.status}`);
    }

    const xmlText = await response.text();
    const title = xmlText.match(/<Service>[\s\S]*?<Title>(.*?)<\/Title>/)?.[1] ?? "";
    const dateMatch = title.match(/(\d{2})\/(\d{2})\/(\d{4})/);

    if (!dateMatch) {
      throw new Error("USDM capabilities title did not include a date.");
    }

    const [, month, day, year] = dateMatch;
    const mapDate = new Date(Number(year), Number(month) - 1, Number(day));
    dateElement.textContent = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(mapDate);
  } catch (error) {
    dateElement.textContent = "Unavailable";
    console.error(error);
  }
}

async function updateRainfallDate(dateElement) {
  try {
    const response = await fetch(rainfallQueryUrl);
    if (!response.ok) {
      throw new Error(`MRMS query request failed: ${response.status}`);
    }

    const result = await response.json();
    const latestTimestamp = result.features
      ?.map((feature) => feature.attributes?.idp_validendtime)
      .filter(Boolean)
      .sort((a, b) => b - a)[0];

    if (!latestTimestamp) {
      throw new Error("MRMS query did not include a valid end time.");
    }

    dateElement.textContent = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(latestTimestamp));
  } catch (error) {
    dateElement.textContent = "Usually by 0:04 after the hour";
    console.error(error);
  }
}
