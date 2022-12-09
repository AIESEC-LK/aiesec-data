const graphql_request_1 = require("graphql-request");
const CONFIG = require("./config");
const { PRODUCTS_T } = require("./constants");
const admin = require("firebase-admin");

// Delete if not running locally
//admin.initializeApp();

const db = admin.firestore();

exports.getPeople = async function(start_date, end_date) {
    let page = 1;
    let people = [];
    let fetched;
    while ((fetched = await getPeople(start_date, end_date, page)) !== []) {
        if (fetched.length === 0) break;
        people = [...people, ...fetched];
        console.log("Page:", page, "\t Fetched:", fetched.length);
        page = page + 1;   
    }
    return people;
}

async function getPeople(start_date, end_date, page) {
    const query = graphql_request_1.gql`
        query PeopleIndexQuery($page: Int, $perPage: Int, $filters: PeopleFilter) {
            allPeople(page: $page, per_page: $perPage, filters: $filters) {
                ...PeopleList
                __typename
            }
        }
        fragment PeopleList on PersonList {
            data {
                email
                id
                full_name
                status
                home_lc {
                    name
                }
                lc_alignment {
                    keywords
                }
                created_at
                is_aiesecer
                person_profile {
                    selected_programmes
                }
            }
        }
    `;
    const variables = {
        "page": page,
        "per_page": 50,
        "filters": {
            "last_interaction": {
              "from": start_date + " 00:00:00",
              "to": end_date + " 23:59:59"
            }
          },
    }

    // ... or create a GraphQL client instance to send requests
    const client = new graphql_request_1.GraphQLClient("https://gis-api.aiesec.org/graphql", {
        headers: {authorization: CONFIG.EXPA_ACCESS_TOKEN}});
    let queryResult;
    queryResult = await client.request(query, variables);

    let people = [];

    for (const person of queryResult.allPeople.data) {
        let person_f = {
            email: person.email,
            id: person.id,
            name: person.full_name,
            status: person.status,
            lc: person.home_lc.name,
            lead_alignment: (person.lc_alignment != null) ? person.lc_alignment.keywords : "",
            signed_up: person.created_at.split("T")[0],
            aiesecer: person.is_aiesecer,
            products_interested_in: productCodesToNames(person.person_profile.selected_programmes)
        }
        await db.collection('people').doc(person.id).set(person_f, {merge: true});
        people.push(person_f);
        //console.log(person_f);
    }
    return people;
}

function productCodesToNames(codeArray) {
    nameArray = [];
    codeArray.forEach(code => {
        nameArray.push(PRODUCTS_T[code]);
    });
    return nameArray.join(", ");
}
