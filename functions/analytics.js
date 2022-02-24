const CONFIG = require("./config");
const CONSTANTS = require("./constants");
const request = require("request-promise");

const admin = require('firebase-admin');

// Delete if not running locally
//admin.initializeApp();

const db = admin.firestore();

const {BigQuery} = require('@google-cloud/bigquery');

const options = {
    keyFilename: 'bq_service_account.json',
    projectId: 'od-dashboard-bc275',
};

const bigquery = new BigQuery(options);

exports.getAnalyticsForDateRange = async function(start, end) {
    const results = await getRange(start, end);
    return results;
}

exports.getAnalyticsForDateRangeNoPush = async function(start, end) {
    console.log(`${start} to ${end}`);
    const path = `v2/applications/analyze.json?access_token=${CONFIG.EXPA_ACCESS_TOKEN}&start_date=${start}&end_date=${end}&performance_v3%5Boffice_id%5D=${CONSTANTS.ASL_OFFICE_ID}`;

    const options = {
        uri: `https://analytics.api.aiesec.org/${path}`,
        method: 'GET',
        json: true
    }

    const data = await request(options);

    let result = {};

    for (const type in CONSTANTS.TYPES) {
        for (const product in CONSTANTS.PRODUCTS) {
            result[CONSTANTS.TYPES[type] + product] = {};

            for (const stage in CONSTANTS.STAGES) {
                result[CONSTANTS.TYPES[type] + product][stage] = {};
                result[CONSTANTS.TYPES[type] + product][stage]["ASL"] = 0;

                for (const entity in CONSTANTS.ENTITIES) {
                    result[CONSTANTS.TYPES[type] + product][stage][entity] = 0;

                    for (const product_code in CONSTANTS.PRODUCTS[product]) {
                        let val;
                        if (stage === "OP") {
                            let tag = `open_${CONSTANTS.TYPES[type]}_programme_${CONSTANTS.PRODUCTS[product][product_code]}`;
                            val = data[CONSTANTS.ENTITIES[entity]][tag]["doc_count"]
                        } else {
                            let tag = `${CONSTANTS.TYPES[type]}_${CONSTANTS.STAGES[stage]}_${CONSTANTS.PRODUCTS[product][product_code]}`;
                            val = data[CONSTANTS.ENTITIES[entity]][tag]["applicants"]['value'];
                        }
                        result[CONSTANTS.TYPES[type] + product][stage][entity] += val;
                    }
                }

                for (const product_code in CONSTANTS.PRODUCTS[product]) {
                    let val;
                    if (stage === "OP") {
                        let tag = `open_${CONSTANTS.TYPES[type]}_programme_${CONSTANTS.PRODUCTS[product][product_code]}`;
                        val = data[tag]["doc_count"]
                    } else {
                        let tag = `${CONSTANTS.TYPES[type]}_${CONSTANTS.STAGES[stage]}_${CONSTANTS.PRODUCTS[product][product_code]}`;
                        val = data[tag]["applicants"]['value'];
                    }
                    result[CONSTANTS.TYPES[type] + product][stage]["ASL"] += val;
                }
            }
        }
    }

    return result;
}

async function getRange(start, end) {
    start = new Date(Date.parse(start));
    end = new Date(Date.parse(end));

    // Re-align start date to the previous mondays
    // start.setDate(start.getDate() - (start.getDay() + 6) % 7);

    const results = {};
    while (end >= start) {
        const start_str = start.toISOString().split("T")[0];
        const end_date = new Date(start);
        end_date.setDate(start.getDate() + 0);
        const end_str = end_date.toISOString().split("T")[0];
        results[start_str] = await _getRange(start_str, end_str);
        start.setDate(start.getDate() + 1);
        await new Promise(r => setTimeout(r, 5000));
    }
    return results;
}

async function _getRange(start, end) {
    console.log(`${start} to ${end}`);
    const path = `v2/applications/analyze.json?access_token=${CONFIG.EXPA_ACCESS_TOKEN}&start_date=${start}&end_date=${end}&performance_v3%5Boffice_id%5D=${CONSTANTS.ASL_OFFICE_ID}`;

    const options = {
        uri: `https://analytics.api.aiesec.org/${path}`,
        method: 'GET',
        json: true
    }

    const data = await request(options);

    let result = {};

    for (const type in CONSTANTS.TYPES) {
        for (const product in CONSTANTS.PRODUCTS) {
            result[CONSTANTS.TYPES[type] + product] = {};

            for (const stage in CONSTANTS.STAGES) {
                result[CONSTANTS.TYPES[type] + product][stage] = {};
                result[CONSTANTS.TYPES[type] + product][stage]["ASL"] = 0;

                for (const entity in CONSTANTS.ENTITIES) {
                    result[CONSTANTS.TYPES[type] + product][stage][entity] = 0;

                    for (const product_code in CONSTANTS.PRODUCTS[product]) {
                        let val;
                        if (stage === "OP") {
                            let tag = `open_${CONSTANTS.TYPES[type]}_programme_${CONSTANTS.PRODUCTS[product][product_code]}`;
                            val = data[CONSTANTS.ENTITIES[entity]][tag]["doc_count"]
                        } else {
                            let tag = `${CONSTANTS.TYPES[type]}_${CONSTANTS.STAGES[stage]}_${CONSTANTS.PRODUCTS[product][product_code]}`;
                            val = data[CONSTANTS.ENTITIES[entity]][tag]["applicants"]['value'];
                        }
                        result[CONSTANTS.TYPES[type] + product][stage][entity] += val;
                    }
                }

                for (const product_code in CONSTANTS.PRODUCTS[product]) {
                    let val;
                    if (stage === "OP") {
                        let tag = `open_${CONSTANTS.TYPES[type]}_programme_${CONSTANTS.PRODUCTS[product][product_code]}`;
                        val = data[tag]["doc_count"]
                    } else {
                        let tag = `${CONSTANTS.TYPES[type]}_${CONSTANTS.STAGES[stage]}_${CONSTANTS.PRODUCTS[product][product_code]}`;
                        val = data[tag]["applicants"]['value'];
                    }
                    result[CONSTANTS.TYPES[type] + product][stage]["ASL"] += val;
                }
            }
        }
    }

    await db.collection('analytics').doc(start).set(result, {merge: true});

    const query = `DELETE FROM analytics.analytics WHERE date = '${start}'`;
    const options2 = {
        query: query,
        timeoutMs: 100000,
        useLegacySql: true
    };
    try {
        await bigquery.query(options2);
    }
    catch {
        console.log("Error deleting");
    }

    const rows = []
    for (const product in result) {
        for (const stage in result[product]) {
            let row = result[product][stage];
            rows.push({
                date: start,
                product,
                stage,
                ...row
            })
        }
    }

    await bigquery
        .dataset("analytics")
        .table("analytics")
        .insert(rows);
    console.log(`Inserted ${rows.length} rows`);

    //rows.map(async row => { await bigquery.dataset('analytics').table('analytics').insert(row) })

    //console.log(rows);
    return result;
}

// Delete unless running locally
// getRange("2022-01-01", "2022-01-01").then(r => {})