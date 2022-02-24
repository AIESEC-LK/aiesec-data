const graphql_request_1 = require("graphql-request");
const CONFIG = require("./config");
const CONSTANTS = require("./constants");

exports.getGTOpportunities = async function() {
    let page = 1;
    let opportunities = [];
    let fetched;
    while ((fetched = await getOpportunities(
        start_date, [...CONSTANTS.PRODUCTS.GTa, ...CONSTANTS.PRODUCTS.GTe], page)) !== []) {
        if (fetched.length === 0) break;
        opportunities = [...opportunities, ...fetched];
        console.log("Page:", page, "\t Fetched:", fetched.length);
        page = page + 1;
    }
    return opportunities;
}

async function getOpportunities(start_date, programs, page) {
    const query = graphql_request_1.gql`
    query GetAllOpportunitiesQuery($page: Int, $per_page: Int, $filters: OpportunityFilter) {
      allOpportunity: allOpportunity(page: $page, per_page: $per_page, filters: $filters) {
        data {
          ...Opportunity
        }
        paging {
          total_items
          total_pages
          current_page
        }
      }
    }
    fragment Opportunity on Opportunity {
      id
      title
      description
      remote_opportunity
      specifics_info {
          salary
          salary_currency {
              alphabetic_code
          }
          salary_periodicity
      }
      sub_product {
          name
      }
      organisation {
          name
      }
      earliest_start_date
      applicants_count
      applications_close_date
      host_lc {
        name
        parent {
            name
            parent {
                name
            }
        }
      }
      partner_type
      is_global_project
      opportunity_duration_type {
        duration_type
      }
      location
      programme {
        short_name_display
      }
      project_name
      role_info {
        learning_points
      }
      backgrounds {
          constant_name
          option
      }
      skills {
          constant_name
          option
      }
      languages {
          constant_name
          option
      }
      application_processing_time,
      nationalities {
          constant_name
          option
      }
      study_levels {
          name
      }
      logistics_info {
          accommodation_covered
          accommodation_provided
          computer_provided
          food_covered
          food_provided
          no_of_meals
          transportation_covered
          transportation_provided
        }
    }
  `;
    const variables = {
        "page": page,
        "per_page": 50,
        "filters": {
            "earliest_start_date": {
                "from": start_date
            },
            "programmes": programs,
        }
    }
    // ... or create a GraphQL client instance to send requests
    const client = new graphql_request_1.GraphQLClient("https://gis-api.aiesec.org/graphql", {
        headers: {authorization: CONFIG.yop_access_token}});
    let queryResult;
    queryResult = await client.request(query, variables);

    let opportunities = [];

    for (const opp of queryResult.allOpportunity.data) {
        const opportunity = {
            id: opp.id,
            title: opp.title,
            host_lc: opp.host_lc.name,
            country: opp.host_lc.parent.name,
            region: opp.host_lc.parent.parent.name,
            product: opp.programme.short_name_display,
            sub_product: opp.sub_product ? opp.sub_product.name : "",
            duration: opp.opportunity_duration_type.duration_type,
            salary_native: getSalary(opp.specifics_info),
            //salary_usd: "1000 USD",
            organization: opp.organisation.name,
            start_date: opp.earliest_start_date ? opp.earliest_start_date.split("T")[0] : "",
            applications_close_date: opp.applications_close_date ? opp.applications_close_date.split("T")[0] : "",
            process_time: opp.application_processing_time,
            description: decodeEntities(opp.description.replace(/<\/?[^>]+(>|$)/g, "").trim()),
            backgrounds: getList(opp.backgrounds),
            skills: getList(opp.skills),
            responsibilities: decodeEntities(opp.role_info.learning_points.replace(/<\/?[^>]+(>|$)/g, "").trim()),
            languages: getList(opp.languages),
            nationalities: getList(opp.nationalities),
            education: getStudyLevels(opp.study_levels),
            accommodation: opp.logistics_info.accommodation_covered + ", " + opp.logistics_info.accommodation_provided,
            food: opp.logistics_info.food_covered + ", " + opp.logistics_info.food_provided,
            transportation: opp.logistics_info.transportation_covered + ", " + opp.logistics_info.transportation_provided,
            computer: opp.logistics_info.computer_provided

        }
        opportunities.push(opportunity);
    }
    return opportunities;
}

function getSalary(specifics_info) {
    return (specifics_info.salary ? specifics_info.salary : 0)
        + " " + specifics_info.salary_currency.alphabetic_code
        + " " + specifics_info.salary_periodicity;
}

function getList(list) {
    let result = [];
    for (let item of list) {
        result.push(item.constant_name + " (" + item.option + ")");
    }
    return result.join(", ");
}

function getStudyLevels(list) {
    let result = [];
    for (let item of list) {
        result.push(item.name);
    }
    return result.join(", ");
}

function decodeEntities(encodedString) {
    var translate_re = /&(nbsp|amp|quot|lt|gt);/g;
    var translate = {
        "nbsp":" ",
        "amp" : "&",
        "quot": "\"",
        "lt"  : "<",
        "gt"  : ">"
    };
    return encodedString.replace(translate_re, function(match, entity) {
        return translate[entity];
    }).replace(/&#(\d+);/gi, function(match, numStr) {
        var num = parseInt(numStr, 10);
        return String.fromCharCode(num);
    });
}
