const fs = require('fs');
const { kml } = require('@tmcw/togeojson');
const { DOMParser } = require('xmldom');

const files = [
    { name: 'Factories', path: '../data_extracted/Factories_kml/doc.kml' },
    { name: 'Government Hospitals', path: '../data_extracted/Gov_kml/doc.kml' },
    { name: 'Private Medical Facilities', path: '../data_extracted/Private_kml/doc.kml' }
];

function extractProperties(descriptionHtml) {
    if (!descriptionHtml) return {};
    
    // togeojson sometimes returns description as an object { '@type': 'html', value: '...' }
    const htmlString = typeof descriptionHtml === 'object' ? descriptionHtml.value : descriptionHtml;
    if (typeof htmlString !== 'string') return {};
    
    // We'll use regex to find all tr tags and their two td children.
    // Using [\s\S]*? to handle any potential newlines across tags.
    const regex = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi;
    const props = {};
    let match;
    
    while ((match = regex.exec(htmlString)) !== null) {
        let key = match[1].replace(/<[^>]*>?/gm, '').trim(); // strip html
        let value = match[2].replace(/<[^>]*>?/gm, '').trim(); // strip html
        
        // Remove trailing or leading spaces/newlines
        key = key.replace(/\n/g, '').trim();
        value = value.replace(/\n/g, '').trim();
        
        if (key && value && key !== 'Name_of_Industry') { // skip some redundant headers
            props[key] = value;
        }
    }
    return props;
}

const allData = {
    type: 'FeatureCollection',
    features: []
};

// ensure public directory exists
if (!fs.existsSync('public')){
    fs.mkdirSync('public');
}

for (const file of files) {
    console.log(`Parsing ${file.name}...`);
    try {
        const kmlString = fs.readFileSync(file.path, 'utf8');
        const kmlDom = new DOMParser().parseFromString(kmlString);
        const geojson = kml(kmlDom);
        
        for (const feature of geojson.features) {
            feature.properties.category = file.name;
            
            // The name is usually already extracted correctly by togeojson
            const name = feature.properties.name || "Unknown";
            
            // Skip the outlier
            if (name.includes("Vijayanand")) {
                continue;
            }
            
            const extractedProps = extractProperties(feature.properties.description);
            feature.properties = {
                name,
                category: file.name,
                ...extractedProps
            };
            
            allData.features.push(feature);
        }
    } catch (e) {
        console.error(`Error parsing ${file.name}:`, e);
    }
}

fs.writeFileSync('public/data.json', JSON.stringify(allData, null, 2));
console.log(`Done! Wrote ${allData.features.length} features.`);
