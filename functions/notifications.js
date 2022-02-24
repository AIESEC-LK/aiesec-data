const request2 = require("request-promise");
const admin = require('firebase-admin');
const db = admin.firestore();

exports.notifyAnalytics = async function(results, entity, start, end, product) {
    let webhookURL;
    try {
        webhookURL = await (await db.collection('notification-channels').doc(`${entity}-${product}`).get()).data().chat_webhook;
    } catch {
        console.log(`Error finding notification channel (${entity}-${product})`);
        return;
    }

    const options = {
        uri: webhookURL,
        method: 'POST',
        body: {
            cards: [
                {
                    header: {
                        title: `Exchange Analytics Update - ${product}`,
                        subtitle: `${start} to ${end} | AIESEC in ${entity}`,                
                    },
                    sections: [
                        {
                            widgets: [
                                {
                                    keyValue: {
                                        topLabel: "Open",
                                        content: `${results[product]["OP"][entity]}`
                                    }
                                },
                                {
                                    keyValue: {
                                        topLabel: "Applied",
                                        content: `${results[product]["APP"][entity]}`
                                    }
                                },
                                {
                                    keyValue: {
                                        topLabel: "Accepted",
                                        content: `${results[product]["ACC"][entity]}`
                                    }
                                },
                                {
                                    keyValue: {
                                        topLabel: "Approved",
                                        content: `${results[product]["APD"][entity]}`
                                    }
                                },
                                {
                                    keyValue: {
                                        topLabel: "Realized",
                                        content: `${results[product]["RE"][entity]}`
                                    }
                                },
                                {
                                    keyValue: {
                                        topLabel: "Finished",
                                        content: `${results[product]["FI"][entity]}`
                                    }
                                },
                                {
                                    keyValue: {
                                        topLabel: "Completed",
                                        content: `${results[product]["CO"][entity]}`
                                    }
                                },
                            ]
                        }
                    ]
                }
            ]
        },
        json: true
    }
    await request2(options);
}