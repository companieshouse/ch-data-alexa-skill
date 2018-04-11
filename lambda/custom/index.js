var Alexa = require('alexa-sdk');
var http = require('https');

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
    'LaunchRequest': function() {
        this.emit('GetCompany');
    },
    'GetCompany': function() {
        var slot;
        var path;
        if ( typeof this.event.request.intent !== "undefined" ) {
            if ( typeof this.event.request.intent.slots !== "undefined" ) {
                slot = this.event.request.intent.slots.number.value;
            }
        }
        if( typeof slot === "undefined" ){ slot = "" };
        path = "/company/" + slot.padStart(8, "0");
        getAPIData((data) => {
            var outputSpeech = "";
            if( typeof data.errors !== "undefined" ) {
                outputSpeech = "No company details were returned. Please check the company number provided";
            }
            else {
                outputSpeech += data.company_name + ", created on " + new Date(data.date_of_creation).toDateString() + ".";
                outputSpeech += ' Next accounts are due: ' + new Date(data.accounts.next_accounts.due_on).toDateString() + ".";
                outputSpeech += ' Next confirmation statement is due: ' + new Date(data.confirmation_statement.next_due).toDateString() + ".";
            }
            this.emit(':tell', outputSpeech.replace('&', "and"));
        }, path);
    },
    'GetOfficers': function() {
        var slot;
        var path;
        if ( typeof this.event.request.intent !== "undefined" ) {
            if ( typeof this.event.request.intent.slots !== "undefined" ) {
                slot = this.event.request.intent.slots.companyNumber.value;
            }
        }
        if( typeof slot === "undefined" ){ slot = "" };
        path = "/company/" + slot.padStart(8, "0") + "/officers?items_per_page=5";
        getAPIData((data) => {
            var outputSpeech = "";
            if( typeof data.errors !== "undefined" ) {
                outputSpeech = "No company details were returned. Please check the company number provided";
            }
            else if ( typeof data.items !== "undefined" ) {
                outputSpeech += "There have been " + data.total_results + " officers of this company: ";
                if (data.active_count > 5) {
                    outputSpeech += "There are " + data.active_count + " active officers. Here are the first five returned. ";
                }
                else {
                    outputSpeech += "There are " + data.active_count + " active officers. ";                  
                }
                for (var i = 0; i < data.items.length; i++) {
                    var officerNum = i+1;
                    outputSpeech += "Officer " + officerNum + ". ";
                    outputSpeech += "Name: " + data.items[i].name + ". ";
                    outputSpeech += "Role: " + data.items[i].officer_role + ". ";
                    outputSpeech += "Appointed: " + data.items[i].appointed_on + ". ";
                }         
            }
            else {
                outputSpeech = "No officer details were returned. Please check the company number provided";
            }
            this.emit(':tell', outputSpeech.replace('&', "and"));
        }, path);
    },
    'AMAZON.HelpIntent': function() {
        this.emit(':ask', "What can I help you with?", "How can I help?");
    },
    'AMAZON.CancelIntent': function() {
        this.emit(':tell', "Okay!");
    },
    'AMAZON.StopIntent': function() {
        this.emit(':tell', "Goodbye!");
    },
    'Unhandled': function () {
        this.emit(':tell', "The service threw an error");
    }
};

function getAPIData(callback, path) {
    var options = {
        host: 'api.companieshouse.gov.uk',
        auth: process.env.api_key,
        path: path,
        method: 'GET'
    };

    var req = http.request(options, res => {
        var returnData = "";

        res.on('data', chunk => {
            returnData = returnData + chunk;
        });

        res.on('end', () => {
            var result = JSON.parse(returnData);
            callback(result);
        });

    }).on('error', err => {
        console.log("Error!", err);
    });
    req.end();
}