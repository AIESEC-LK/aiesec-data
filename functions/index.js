const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp();

const ObjectsToCsv = require('objects-to-csv');
const opportunities = require("./opportunities");
const analytics = require("./analytics");
const notifications = require("./notifications");
const people = require("./people");

exports.getGTOpportunities = functions
    .runWith({
        timeoutSeconds: 300,
        memory: "1GB",
    })
    .https.onRequest(async (request, response) => {

    const opportunities_list = await opportunities.getGTOpportunities("2021-09-27");

    const csv = new ObjectsToCsv(opportunities_list);
    await csv.toDisk('./test.csv', {append: false});

    response.send("Opportunities fetched: " + opportunities_list.length);
});

exports.getAnalyticsForDateRange = functions
    .runWith({
        timeoutSeconds: 540,
        memory: "1GB",
    })
    .https.onRequest(async (request, response) => {
        const result = await analytics.getAnalyticsForDateRange(request.query.start, request.query.end);
        response.send(result);
    });

exports.scheduledAnalyticsDaily = functions.pubsub.schedule('30 07 * * *')
    .timeZone('Asia/Calcutta')
    .onRun(async (context) => {
        let yesterday = getYesterday();
        await analytics.getAnalyticsForDateRange(yesterday, yesterday);
    });

exports.notifyLastWeek = functions
    .runWith({
        timeoutSeconds: 300,
        memory: "1GB",
    })
    .https.onRequest(async (request, response) => {
        results = await notifyLastWeekInternal();
        response.send(results);
    });

exports.schedulednotifyLastWeek = functions.pubsub.schedule('30 9 * * 1')
    .timeZone('Asia/Calcutta')
    .onRun(async (context) => {
        results = await notifyLastWeekInternal();
        response.send(results);
    });

exports.getPeople = functions
    .runWith({
        timeoutSeconds: 300,
        memory: "1GB",
    })
    .https.onRequest(async (request, response) => {
        const people_list = await people.getPeople(request.query.start, request.query.end);
        response.send("People fetched: " + people_list.length);
    });

exports.getPeopleDaily = functions.pubsub.schedule('30 06 * * *')
    .timeZone('Asia/Calcutta')
    .onRun(async (context) => {
        let yesterday = getYesterday();
        await people.getPeople(yesterday, yesterday);
    });

async function notifyLastWeekInternal() {
    const start = getLastWeek();
    const end = getYesterday();
    const results = await analytics.getAnalyticsForDateRangeNoPush(start, end);
    const entities = ["ASL", "CC", "CN", "CS", "Kandy", "USJ", "SLIIT", "Ruhuna", "NSBM"];
    const products = ["iGV", "iGTa", "iGTe", "oGV", "oGTa", "oGTe"];

    for (let entity of entities) {
        for (let product of products) {
            await notifications.notifyAnalytics(results, entity, start, end, product);
        }
    }

    return results;
}

function getYesterday() {
    let d = new Date();
    let utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    let nd = new Date(utc + (3600000*5.5));
    nd.setDate(nd.getDate() - 1);
    return nd.toISOString().split('T')[0];
}

function getLastWeek() {
    let d = new Date();
    let utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    let nd = new Date(utc + (3600000*5.5));
    nd.setDate(nd.getDate() - 7);
    return nd.toISOString().split('T')[0];
}