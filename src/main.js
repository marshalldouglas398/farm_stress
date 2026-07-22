import L from "leaflet";
import "leaflet/dist/leaflet.css";
import proj4 from "proj4";
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
const cropWmsUrl = "https://nassgeodata.gmu.edu/CropScapeService/wms_cdl_sc.cgi";
const cropYears = ["2025", "2024", "2023", "2022", "2021", "2020"];
const cdlProjection =
  "+proj=aea +lat_1=29.5 +lat_2=45.5 +lat_0=23 +lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs";
const droughtLevels = {
  0: "D0 Abnormally dry",
  1: "D1 Moderate drought",
  2: "D2 Severe drought",
  3: "D3 Extreme drought",
  4: "D4 Exceptional drought",
};
const droughtToggle = document.querySelector("#drought-toggle");
const droughtOpacity = document.querySelector("#drought-opacity");
const droughtDate = document.querySelector("#drought-date");
const rainfallToggle = document.querySelector("#rainfall-toggle");
const rainfallOpacity = document.querySelector("#rainfall-opacity");
const rainfallAccumulation = document.querySelector("#rainfall-accumulation");
const rainfallDate = document.querySelector("#rainfall-date");
const cropToggle = document.querySelector("#crop-toggle");
const cropOpacity = document.querySelector("#crop-opacity");
const cropYear = document.querySelector("#crop-year");
const cropDate = document.querySelector("#crop-date");
const hoverCard = document.querySelector("#hover-card");
const hoverCrop = document.querySelector("#hover-crop");
const hoverDrought = document.querySelector("#hover-drought");
const hoverRainfall = document.querySelector("#hover-rainfall");

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

const cropLayer = L.tileLayer.wms(cropWmsUrl, {
  layers: "cdl_2025_sc",
  format: "image/png",
  transparent: true,
  version: "1.1.1",
  opacity: 0.72,
  crs: L.CRS.EPSG4326,
  attribution: "Cropland Data Layer: USDA NASS",
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
setupHoverInspector();
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

  for (const year of cropYears) {
    const option = document.createElement("option");
    option.value = `cdl_${year}_sc`;
    option.textContent = year;
    option.selected = year === "2025";
    cropYear.append(option);
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

  cropToggle.addEventListener("change", () => {
    if (cropToggle.checked) {
      cropLayer.addTo(map);
      return;
    }

    cropLayer.remove();
  });

  droughtOpacity.addEventListener("input", () => {
    droughtLayer.setOpacity(Number(droughtOpacity.value) / 100);
  });

  rainfallOpacity.addEventListener("input", () => {
    rainfallLayer.setOpacity(Number(rainfallOpacity.value) / 100);
  });

  cropOpacity.addEventListener("input", () => {
    cropLayer.setOpacity(Number(cropOpacity.value) / 100);
  });

  rainfallAccumulation.addEventListener("change", () => {
    rainfallLayer.setParams({ layers: rainfallAccumulation.value });
  });

  cropYear.addEventListener("change", () => {
    cropLayer.setParams({ layers: cropYear.value });
    cropDate.textContent = `${cropYear.selectedOptions[0].textContent} CDL`;
  });
}

function setupHoverInspector() {
  let requestId = 0;
  let hoverTimer;

  map.on("mousemove", (event) => {
    hoverCard.hidden = false;
    positionHoverCard(event.containerPoint);

    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(async () => {
      const currentRequest = ++requestId;
      setHoverLoading();

      const [crop, drought, rainfall] = await Promise.all([
        getCropAt(event.latlng),
        getDroughtAt(event.latlng, event.containerPoint),
        getRainfallAt(event.latlng),
      ]);

      if (currentRequest !== requestId) {
        return;
      }

      hoverCrop.textContent = crop;
      hoverDrought.textContent = drought;
      hoverRainfall.textContent = rainfall;
    }, 220);
  });

  map.on("mouseout", () => {
    clearTimeout(hoverTimer);
    hoverCard.hidden = true;
  });
}

function positionHoverCard(point) {
  const mapSize = map.getSize();
  const xOffset = point.x > mapSize.x - 280 ? -270 : 16;
  const yOffset = point.y > mapSize.y - 170 ? -150 : 16;

  hoverCard.style.transform = `translate(${point.x + xOffset}px, ${point.y + yOffset}px)`;
}

function setHoverLoading() {
  hoverCrop.textContent = "Loading...";
  hoverDrought.textContent = "Loading...";
  hoverRainfall.textContent = "Loading...";
}

async function getCropAt(latlng) {
  try {
    const [x, y] = proj4("EPSG:4326", cdlProjection, [latlng.lng, latlng.lat]);
    const year = cropYear.selectedOptions[0]?.textContent ?? "2025";
    const params = new URLSearchParams({
      year,
      x: x.toFixed(1),
      y: y.toFixed(1),
    });

    const response = await fetch(`/api/cdl-value?${params}`);
    if (!response.ok) {
      throw new Error(`CDL value request failed: ${response.status}`);
    }

    const text = await response.text();
    const category = text.match(/category:\s*"([^"]+)"/)?.[1];
    const value = text.match(/value:\s*([^,\s}]+)/)?.[1];

    if (!category || category === "No Data") {
      return "No CDL crop value";
    }

    return value ? `${category} (${year}, code ${value})` : `${category} (${year})`;
  } catch (error) {
    console.error(error);
    return "Unavailable";
  }
}

async function getDroughtAt(latlng, containerPoint) {
  try {
    const bounds = map.getBounds();
    const size = map.getSize();
    const southWest = map.options.crs.project(bounds.getSouthWest());
    const northEast = map.options.crs.project(bounds.getNorthEast());
    const params = new URLSearchParams({
      SERVICE: "WMS",
      VERSION: "1.1.1",
      REQUEST: "GetFeatureInfo",
      LAYERS: "usdm_current",
      QUERY_LAYERS: "usdm_current",
      STYLES: "",
      SRS: "EPSG:3857",
      BBOX: [southWest.x, southWest.y, northEast.x, northEast.y].join(","),
      WIDTH: Math.round(size.x),
      HEIGHT: Math.round(size.y),
      X: Math.round(containerPoint.x),
      Y: Math.round(containerPoint.y),
      INFO_FORMAT: "text/plain",
    });

    const separator = droughtWmsUrl.includes("?") ? "&" : "?";
    const response = await fetch(`${droughtWmsUrl}${separator}${params}`);
    if (!response.ok) {
      throw new Error(`USDM feature-info request failed: ${response.status}`);
    }

    const text = await response.text();
    const level = text.match(/DM\s*=\s*'(\d)'/)?.[1];

    if (!level) {
      return "No drought classification";
    }

    return droughtLevels[level] ?? `D${level}`;
  } catch (error) {
    console.error(error);
    return "Unavailable";
  }
}

async function getRainfallAt(latlng) {
  try {
    const layerName = rainfallAccumulation.selectedOptions[0]?.value ?? rainfallLayers["24 hours"];
    const label = rainfallAccumulation.selectedOptions[0]?.textContent ?? "24 hours";
    const rasterFunction = layerName.split(":").at(-1);
    const geometry = {
      x: latlng.lng,
      y: latlng.lat,
      spatialReference: { wkid: 4326 },
    };
    const params = new URLSearchParams({
      geometry: JSON.stringify(geometry),
      geometryType: "esriGeometryPoint",
      returnGeometry: "false",
      returnCatalogItems: "false",
      renderingRule: JSON.stringify({ rasterFunction }),
      f: "pjson",
    });

    const response = await fetch(
      `https://mapservices.weather.noaa.gov/raster/rest/services/obs/mrms_qpe/ImageServer/identify?${params}`,
    );
    if (!response.ok) {
      throw new Error(`MRMS identify request failed: ${response.status}`);
    }

    const result = await response.json();
    const value = Number(result.value);

    if (!Number.isFinite(value) || value <= 0) {
      return `No measurable rainfall (${label})`;
    }

    return `${value.toFixed(2)} in (${label})`;
  } catch (error) {
    console.error(error);
    return "Unavailable";
  }
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
