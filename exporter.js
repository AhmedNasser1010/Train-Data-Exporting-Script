// Last process time 40sec
const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser");
const axios = require("axios");
const { performance } = require("perf_hooks");

const BASE_URL =
  "https://egytrains.com/_next/data/8KEk8nmc9-2UCQW_WO3Dz/trains/";
const stationsFilePath = path.join(__dirname, "./data v1/stations.csv");
const outputFilePath = path.join(__dirname, "all_stations_output.csv");

function loadStationsMap() {
  console.log("Loading station mappings from CSV...");
  return new Promise((resolve, reject) => {
    const stationMap = {};
    fs.createReadStream(stationsFilePath)
      .pipe(csvParser())
      .on("data", (row) => {
        const enName = row.en_name?.trim();
        const stationId = row.id;
        if (enName && !stationMap[enName]) {
          stationMap[enName] = stationId;
        }
      })
      .on("end", () => {
        console.log(
          `Loaded ${Object.keys(stationMap).length} station mappings (English names only).`,
        );
        resolve(stationMap);
      })
      .on("error", (err) => {
        console.error("Error loading station mappings:", err.message);
        reject(err);
      });
  });
}

// Fetch JSON data for a station
async function fetchStationData(stationName) {
  const url = `${BASE_URL}${stationName}.json`;
  console.log(`Fetching data for station: ${stationName} (${url})`);
  try {
    const response = await axios.get(url);
    console.log(`Successfully fetched data for station: ${stationName}`);
    return response.data;
  } catch (err) {
    console.error(
      `Failed to fetch data for station: ${stationName}. Error: ${err.message}`,
    );
    return null;
  }
}

// Generate CSV from all stations
async function generateAllStationsCSV() {
  console.log("Starting CSV generation process...");
  const startTime = performance.now();

  try {
    const stationsMap = await loadStationsMap();
    const stationNames = Object.keys(stationsMap);
    const output = [
      [
        "id",
        "train_number",
        "stop_order",
        "station_id",
        "arrival_time",
        "departure_time",
      ],
    ];
    let rowId = 1; // Initialize ID counter

    for (let i = 0; i < stationNames.length; i++) {
      const stationName = stationNames[i];
      console.log(
        `Processing station (${i + 1}/${stationNames.length}): ${stationName}`,
      );
      const stationData = await fetchStationData(stationName);

      if (stationData) {
        console.log(`Parsing train data for station: ${stationName}`);
        const trains = stationData.pageProps.data.trains;

        for (const [trainNumber, trainDetails] of Object.entries(trains)) {
          trainDetails.cities.forEach((city, index) => {
            const stationId = stationsMap[city.name];
            // Terminate if there is 'UNKNOWN' stations
            // if (!stationId) {
            //   throw new Error(
            //     `Error: Station ID is 'UNKNOWN' for station name '${city.name}' in train ${trainNumber}`,
            //   );
            // }
            const arrivalTime = city.a || "";
            const departureTime = city.d || "";
            output.push([
              rowId++,
              trainNumber,
              index + 1,
              stationId,
              arrivalTime,
              departureTime,
            ]);
          });
        }
        console.log(
          `Finished processing train data for station: ${stationName}`,
        );
      } else {
        console.log(`Skipping station due to missing data: ${stationName}`);
      }
    }

    // Write output to CSV
    console.log("Writing data to output CSV file...");
    const csvContent = output.map((row) => row.join(",")).join("\n");
    fs.writeFileSync(outputFilePath, csvContent, "utf8");
    console.log(`CSV file created successfully at ${outputFilePath}`);
  } catch (err) {
    console.error(`Script terminated: ${err.message}`);
    process.exit(1);
  }

  const endTime = performance.now();
  console.log(`Process completed in ${(endTime - startTime) / 1000} seconds.`);
}

generateAllStationsCSV();
