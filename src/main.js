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
      "USDM drought severity": droughtLayer,
      "MRMS rainfall estimate": rainfallLayer,
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
const droughtLegend = addDroughtLegend(map, droughtLayer);
updateDroughtDate(droughtLegend.dateElement);
const rainfallLegend = addRainfallLegend(map, rainfallLayer);
updateRainfallDate(rainfallLegend.dateElement);
map.fitBounds(countiesLayer.getBounds(), { padding: [20, 20] });

function addDroughtLegend(map, droughtLayer) {
  const legend = L.control({ position: "bottomright" });
  let dateElement;

  legend.onAdd = () => {
    const element = L.DomUtil.create("div", "drought-legend");
    element.innerHTML = `
      <div class="legend-title">U.S. Drought Monitor</div>
      <div class="legend-subtitle">Current sub-county severity polygons</div>
      <div class="legend-date">Map date: <strong data-drought-date>Loading...</strong></div>
      <div class="legend-row"><span style="background:#ffff00"></span>D0 Abnormally dry</div>
      <div class="legend-row"><span style="background:#fcd37f"></span>D1 Moderate drought</div>
      <div class="legend-row"><span style="background:#ffaa00"></span>D2 Severe drought</div>
      <div class="legend-row"><span style="background:#e60000"></span>D3 Extreme drought</div>
      <div class="legend-row"><span style="background:#730000"></span>D4 Exceptional drought</div>
      <label class="opacity-control">
        Overlay opacity
        <input type="range" min="20" max="100" value="78" />
      </label>
    `;

    dateElement = element.querySelector("[data-drought-date]");
    const slider = element.querySelector("input");
    slider.addEventListener("input", () => {
      droughtLayer.setOpacity(Number(slider.value) / 100);
    });

    L.DomEvent.disableClickPropagation(element);
    L.DomEvent.disableScrollPropagation(element);

    return element;
  };

  legend.addTo(map);
  return { dateElement };
}

function addRainfallLegend(map, rainfallLayer) {
  const legend = L.control({ position: "bottomleft" });
  let dateElement;

  legend.onAdd = () => {
    const element = L.DomUtil.create("div", "rainfall-legend");
    const layerOptions = Object.entries(rainfallLayers)
      .map(([label, layerName]) => {
        const selected = label === "24 hours" ? " selected" : "";
        return `<option value="${layerName}"${selected}>${label}</option>`;
      })
      .join("");

    element.innerHTML = `
      <div class="legend-title">NOAA MRMS Rainfall</div>
      <div class="legend-subtitle">Radar-only QPE, 1 km grid, inches</div>
      <div class="legend-date">Updated: <strong data-rainfall-date>Loading...</strong></div>
      <label class="select-control">
        Accumulation
        <select>${layerOptions}</select>
      </label>
      <label class="opacity-control">
        Overlay opacity
        <input type="range" min="20" max="100" value="62" />
      </label>
    `;

    dateElement = element.querySelector("[data-rainfall-date]");
    const select = element.querySelector("select");
    const slider = element.querySelector("input");

    select.addEventListener("change", () => {
      rainfallLayer.setParams({ layers: select.value });
    });

    slider.addEventListener("input", () => {
      rainfallLayer.setOpacity(Number(slider.value) / 100);
    });

    L.DomEvent.disableClickPropagation(element);
    L.DomEvent.disableScrollPropagation(element);

    return element;
  };

  legend.addTo(map);
  return { dateElement };
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
