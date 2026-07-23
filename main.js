import L from 'leaflet';

let map;
let allFeatures = [];
let markersLayer = L.layerGroup();
let activeVisuals = L.layerGroup();
let activeFilters = new Set();
let userMarker = null;
let searchQuery = '';
let currentFilteredFeatures = [];

const categoryColors = {
  'Factories': '#ef4444', // Red
  'Government Hospitals': '#10b981', // Green
  'Private Medical Facilities': '#3b82f6' // Blue
};

const categoryClasses = {
  'Factories': 'cat-factory',
  'Government Hospitals': 'cat-gov',
  'Private Medical Facilities': 'cat-private'
};

async function init() {
  // Initialize map
  map = L.map('map', {
    zoomControl: false // We can add custom zoom control if needed
  }).setView([30.900965, 75.857275], 11); // Center around Ludhiana

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Add CartoDB Positron base map (clean, modern)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  markersLayer.addTo(map);
  activeVisuals.addTo(map);

  // Fetch data
  try {
    const response = await fetch('/data.json');
    const data = await response.json();
    
    // Load custom features from local storage
    const customData = JSON.parse(localStorage.getItem('lisers_custom_features') || '[]');
    allFeatures = [...data.features, ...customData];
    
    // Default all filters to ON
    Object.keys(categoryColors).forEach(cat => activeFilters.add(cat));
    
    renderFilters();
    updateMap();
    updateStats();
    
    // Initialize Modal Events
    initModal();
    initIndustryModal();
  } catch (err) {
    console.error("Error loading data:", err);
  }

  // Setup close details panel
  document.getElementById('close-details').addEventListener('click', () => {
    document.getElementById('details-panel').classList.remove('open');
    activeVisuals.clearLayers();
  });

  // Setup locate button
  const locateBtn = document.getElementById('locate-btn');
  locateBtn.addEventListener('click', locateUser);

  // Setup search input
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    updateMap();
  });

  // Setup export button
  const exportBtn = document.getElementById('export-btn');
  exportBtn.addEventListener('click', exportContactsCSV);
}

// Export logic for the window
window.exportContactsCSV = exportContactsCSV;
window.closeActivePopup = () => {
  if (map) map.closePopup();
};

// Modal Logic
function initModal() {
  const modal = document.getElementById('add-facility-modal');
  const addBtn = document.getElementById('add-facility-btn');
  const closeBtn = document.getElementById('close-modal-btn');
  const form = document.getElementById('facility-form');

  addBtn.addEventListener('click', () => {
    modal.classList.add('active');
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('ff-name').value;
    const type = document.getElementById('ff-type').value;
    const category = document.getElementById('ff-category').value;
    const ownership = document.getElementById('ff-ownership').value;
    const hospitalCategory = document.getElementById('ff-hospital-category').value;
    const address = document.getElementById('ff-address').value;
    const lat = parseFloat(document.getElementById('ff-lat').value);
    const lng = parseFloat(document.getElementById('ff-lng').value);

    // Build properties object
    const properties = {
      name: name,
      category: category === 'Hospital' || category === 'CHC' || category === 'PHC' || category === 'Clinic' ? 'Government Hospitals' : 'Private Medical Facilities', // Map to marker groups
      Type_of_Facility: type,
      Category: category,
      Ownership: ownership,
      Hospital_Catagory: hospitalCategory,
      Complete_Address: address,
      District: document.getElementById('ff-district').value,
      'Block/Tehsil': document.getElementById('ff-block').value,
      'Ward/Village': document.getElementById('ff-ward').value,
      Total_Bed_Capacity: document.getElementById('ff-beds').value,
      'ICU_Beds_(Yes/No_&_Number)': document.getElementById('ff-icu').value,
      'Emergency_Services_(24x7)': document.getElementById('ff-emergency').value,
      Operation_Theatre: document.getElementById('ff-ot').value,
      Oxygen_Facility: document.getElementById('ff-oxygen').value,
      Ambulance_Availability: document.getElementById('ff-ambulance').value,
      Number_of_Doctors: document.getElementById('ff-doctors').value,
      Number_of_Specialists: document.getElementById('ff-specialists').value,
      Nursing_Staff_Strength: document.getElementById('ff-nurses').value,
      Paramedical_Staff_Strength: document.getElementById('ff-paramedical').value,
      Departments_Available: document.getElementById('ff-departments').value,
      Diagnostic_Facilities: document.getElementById('ff-diagnostic').value,
      Pharmacy: document.getElementById('ff-pharmacy').value,
      Disaster_Response_Readiness: document.getElementById('ff-disaster').value,
      Emergency_Tie_ups: document.getElementById('ff-tieups').value,
      Name_of_In_charge: document.getElementById('ff-incharge').value,
      Contact_Number: document.getElementById('ff-contact').value,
      Email_ID: document.getElementById('ff-email').value
    };

    // Fix category explicitly if it's Private
    if (type === 'Private' && category !== 'Factories') {
      properties.category = 'Private Medical Facilities';
    }

    const newFeature = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat, 0]
      },
      properties: properties,
      id: "CUSTOM_ID_" + Date.now()
    };

    // Save to all features
    allFeatures.push(newFeature);
    
    // Persist to local storage
    const customData = JSON.parse(localStorage.getItem('lisers_custom_features') || '[]');
    customData.push(newFeature);
    localStorage.setItem('lisers_custom_features', JSON.stringify(customData));

    // Update UI
    updateMap();
    modal.classList.remove('active');
    form.reset();
  });
}

function initIndustryModal() {
  const modal = document.getElementById('add-industry-modal');
  const addBtn = document.getElementById('add-industry-btn');
  const closeBtn = document.getElementById('close-industry-modal-btn');
  const form = document.getElementById('industry-form');

  addBtn.addEventListener('click', () => {
    modal.classList.add('active');
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('ind-name').value;
    const address = document.getElementById('ind-address').value;
    const lat = parseFloat(document.getElementById('ind-lat').value);
    const lng = parseFloat(document.getElementById('ind-lng').value);
    const type = document.getElementById('ind-type').value;
    const chemicals = document.getElementById('ind-chemicals').value;
    const risk = document.getElementById('ind-risk').value;
    const process = document.getElementById('ind-process').value;
    const contact = document.getElementById('ind-contact').value;
    const email = document.getElementById('ind-email').value;

    const properties = {
      name: name,
      category: 'Factories',
      Address: address,
      Industry_Type_Classification: type,
      Potential_Hazardous_Chemical_or_Gas: chemicals,
      Risk_Level_Catagory: risk,
      Material_Process_Due_Which_Catagoty: process,
      Contact_Number: contact,
      Email_ID: email
    };

    const newFeature = {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat, 0]
      },
      properties: properties,
      id: "CUSTOM_IND_ID_" + Date.now()
    };

    // Save to all features
    allFeatures.push(newFeature);
    
    // Persist to local storage
    const customData = JSON.parse(localStorage.getItem('lisers_custom_features') || '[]');
    customData.push(newFeature);
    localStorage.setItem('lisers_custom_features', JSON.stringify(customData));

    // Update UI
    updateMap();
    modal.classList.remove('active');
    form.reset();
  });
}

function locateUser() {
  const locateBtn = document.getElementById('locate-btn');
  const originalText = locateBtn.innerHTML;
  
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    return;
  }
  
  locateBtn.innerHTML = 'Locating...';
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      if (userMarker) {
        map.removeLayer(userMarker);
      }
      
      const userIcon = L.divIcon({
        className: 'user-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      
      userMarker = L.marker([lat, lng], { icon: userIcon })
        .bindTooltip("<b>Your Location</b>", { direction: 'top', offset: [0, -10], className: 'custom-tooltip' })
        .addTo(map);
        
      map.flyTo([lat, lng], 13, { duration: 1.5 });
      locateBtn.innerHTML = originalText;
    },
    (error) => {
      console.error(error);
      alert("Unable to retrieve your location");
      locateBtn.innerHTML = originalText;
    }
  );
}

function createCustomIcon(color) {
  const markerHtml = `
    <div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 0 10px ${color}88;
      transition: transform 0.2s;
    "></div>
  `;
  return L.divIcon({
    html: markerHtml,
    className: 'custom-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
}

function renderFilters() {
  const filterContainer = document.getElementById('filter-list');
  filterContainer.innerHTML = '';

  Object.keys(categoryColors).forEach(category => {
    const item = document.createElement('label');
    item.className = 'filter-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'filter-checkbox';
    checkbox.checked = activeFilters.has(category);
    checkbox.addEventListener('change', (e) => {
      if (e.target.checked) {
        activeFilters.add(category);
      } else {
        activeFilters.delete(category);
      }
      updateMap();
    });

    const label = document.createElement('span');
    label.className = 'filter-label';
    label.textContent = category;

    // Small color dot
    const dot = document.createElement('div');
    dot.style.width = '10px';
    dot.style.height = '10px';
    dot.style.borderRadius = '50%';
    dot.style.backgroundColor = categoryColors[category];
    dot.style.marginLeft = 'auto';

    item.appendChild(checkbox);
    item.appendChild(label);
    item.appendChild(dot);
    filterContainer.appendChild(item);
  });
}

function updateMap() {
  markersLayer.clearLayers();
  activeVisuals.clearLayers();
  
  currentFilteredFeatures = allFeatures.filter(f => {
    if (!activeFilters.has(f.properties.category)) return false;
    
    if (searchQuery) {
      const name = (f.properties.name || '').toLowerCase();
      const chemical = (f.properties.Potential_Hazardous_Chemical_or_Gas || '').toLowerCase();
      if (!name.includes(searchQuery) && !chemical.includes(searchQuery)) {
        return false;
      }
    }
    return true;
  });
  
  if (currentFilteredFeatures.length === 0) {
    updateStats(0);
    return;
  }

  const bounds = L.latLngBounds();

  currentFilteredFeatures.forEach(feature => {
    const coords = feature.geometry.coordinates;
    const latlng = [coords[1], coords[0]];
    const color = categoryColors[feature.properties.category];
    
    const marker = L.marker(latlng, {
      icon: createCustomIcon(color)
    });

    // Create exact ArcGIS style popup structure
    let popupContentHtml = `
      <div class="arcgis-popup">
        <div class="arcgis-header">
          <span>Pop-up</span>
          <div class="arcgis-controls">
            <span style="font-size: 14px; margin-top: -2px;">&#8964;</span> 
            <span style="border: 1px solid #ccc; padding: 0 4px; border-radius: 2px;">&#10064;</span>
            <span onclick="closeActivePopup()" style="font-weight: bold; margin-left: 4px; cursor: pointer;" title="Close">&#10005;</span>
          </div>
        </div>
        <div class="arcgis-body">
          <div class="arcgis-layer-title"><span class="triangle">&#9658;</span> ${feature.properties.category || 'Facilities'} (1)</div>
          <div class="arcgis-feature-title">${feature.properties.name}</div>
          <table class="arcgis-table">
            <tr>
              <td colspan="2" class="arcgis-table-title">${feature.properties.category || 'Facilities'} - ${feature.properties.name}</td>
            </tr>
    `;

    const ignoreKeys = ['name', 'category', 'styleUrl', 'styleHash', 'styleMapHash', 'icon'];
    let rowIndex = 0;
    
    for (const [key, value] of Object.entries(feature.properties)) {
      if (ignoreKeys.includes(key)) continue;
      
      const bgColor = rowIndex % 2 === 0 ? '#FFFFFF' : '#D4E4F3';
      const displayKey = key.replace(/_/g, ' ');
      
      popupContentHtml += `
        <tr style="background: ${bgColor};">
          <td style="width: 45%; color: #666;">${displayKey}</td>
          <td style="width: 55%; font-weight: 500;">${value}</td>
        </tr>
      `;
      rowIndex++;
    }

    popupContentHtml += `
          </table>
        </div>
        <div class="arcgis-footer">
          <span>&#9664; 1 of 1 &#9654;</span>
          <span>${latlng[1].toFixed(8)}&deg;E ${latlng[0].toFixed(8)}&deg;N</span>
          <span style="letter-spacing: 4px;">&#128269; &#128461; &#128269;</span>
        </div>
      </div>
    `;

    // Add Popup to marker
    marker.bindPopup(popupContentHtml, {
      maxWidth: 400,
      minWidth: 300,
      className: 'custom-gis-popup'
    });

    marker.bindTooltip(`<b>${feature.properties.name}</b>`, {
      direction: 'top',
      offset: [0, -10],
      className: 'custom-tooltip'
    });

    marker.on('click', () => {
      // Keep the routing and radius logic
      handleMarkerClick(feature.properties, feature);
    });

    markersLayer.addLayer(marker);
    bounds.extend(latlng);
  });

  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  updateStats(currentFilteredFeatures.length);
}

function updateStats(count) {
  const total = count !== undefined ? count : allFeatures.length;
  document.getElementById('total-facilities').textContent = total;
}

function handleMarkerClick(properties, feature) {
  activeVisuals.clearLayers(); // Clear previous radius/lines

  // Removed sidebar detail panel rendering since we are using Popups now

  // Add Hazard Radius & Routing for Factories
  if (properties.category === 'Factories' && feature) {
    const factoryLatLng = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
    
    // 1. Draw Hazard Radius
    const radius = L.circle(factoryLatLng, {
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.15,
      radius: 1000,
      weight: 2,
      dashArray: '5, 5'
    }).bindTooltip('1km Hazard Radius').addTo(activeVisuals);

    // 2. Strategic Routing to Nearest Hospital
    const hospitals = allFeatures.filter(f => f.properties.category.includes('Hospital') || f.properties.category.includes('Medical'));
    
    let nearestDist = Infinity;
    let nearestHospital = null;

    hospitals.forEach(h => {
      const hLatLng = L.latLng(h.geometry.coordinates[1], h.geometry.coordinates[0]);
      const dist = factoryLatLng.distanceTo(hLatLng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestHospital = h;
      }
    });

    if (nearestHospital) {
      const hLatLng = L.latLng(nearestHospital.geometry.coordinates[1], nearestHospital.geometry.coordinates[0]);
      
      const polyline = L.polyline([factoryLatLng, hLatLng], {
        color: '#f59e0b',
        weight: 3,
        dashArray: '10, 10',
        opacity: 0.8
      }).bindTooltip(`Nearest Hospital: ${nearestHospital.properties.name} (${(nearestDist/1000).toFixed(2)} km)`).addTo(activeVisuals);

      // Add a small pulse marker at the hospital end
      const hospitalCircle = L.circleMarker(hLatLng, {
        radius: 6,
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 1
      }).addTo(activeVisuals);
      
      // Auto adjust bounds to show both (removed to prevent popup from closing)
      // const routeBounds = L.latLngBounds([factoryLatLng, hLatLng]);
      // map.fitBounds(routeBounds, { padding: [100, 100], maxZoom: 14 });
    } else {
      // map.flyTo(factoryLatLng, 14);
    }
  } else if (feature) {
    // const latLng = L.latLng(feature.geometry.coordinates[1], feature.geometry.coordinates[0]);
    // map.flyTo(latLng, 15);
  }
}

function exportContactsCSV() {
  if (currentFilteredFeatures.length === 0) {
    alert("No data to export.");
    return;
  }

  const headers = ['Name', 'Category', 'Contact Number', 'Email ID', 'Address', 'Hazardous Chemical'];
  const rows = [headers];

  currentFilteredFeatures.forEach(f => {
    const p = f.properties;
    rows.push([
      `"${(p.name || '').replace(/"/g, '""')}"`,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      `"${(p.Contact_Number || '').replace(/"/g, '""')}"`,
      `"${(p.Email_ID || p.email || '').replace(/"/g, '""')}"`,
      `"${(p.Address || '').replace(/"/g, '""')}"`,
      `"${(p.Potential_Hazardous_Chemical_or_Gas || '').replace(/"/g, '""')}"`
    ]);
  });

  const csvContent = rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "LISERS_Emergency_Contacts.csv");
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
