var Alexa = require('alexa-sdk');
var AWS = require('aws-sdk');
var http = require('https');

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.appId = process.env.app_id;
    alexa.dynamoDBTableName = "alexa-ch-data";
    alexa.registerHandlers(handlers);
    alexa.execute();
};
AWS.config.update({
  region: process.env.region
});

var handlers = {
    'LaunchRequest': function() {
        this.emit('StoreCompany');
    },
    'GetCompany': function() {
        var companyNumber;
        var path;

        let isTestingWithSimulator = false; //autofill slots when using simulator, dialog management is only supported with a device
        let filledSlots = delegateSlotCollection.call(this, isTestingWithSimulator);
        
        if ( typeof this.event.request.intent !== "undefined" ) {
            if ( typeof this.event.request.intent.slots !== "undefined" ) {
                companyNumber = retrieveCompanyNumber.call(this, this.event.request.intent.slots);
            }
        }
        console.log("Back from delegateSlotCollection, slot is: ", companyNumber);
        path = "/company/" + companyNumber;
        getAPIData((data) => {
            var outputSpeech = "";
            
            if( typeof data.errors !== "undefined" ) {
                outputSpeech = "No company details were returned. Please check the company number provided";
            }
            else {
                console.log("data returned: ", data);
                outputSpeech += data.company_name + ", created on " + new Date(data.date_of_creation).toDateString() + ".";
                outputSpeech += ' Next accounts are due: ' + new Date(data.accounts.next_accounts.due_on).toDateString() + ".";
                outputSpeech += ' Next confirmation statement is due: ' + new Date(data.confirmation_statement.next_due).toDateString() + ".";
            }
            this.emit(':tellWithCard', outputSpeech.replace('&', "and"), "Get Company " + companyNumber, outputSpeech.replace('&', "and"), "");
        }, path);
    },
    'GetOfficers': function() {
        var companyNumber;
        var path;

        let isTestingWithSimulator = false; //autofill slots when using simulator, dialog management is only supported with a device
        let filledSlots = delegateSlotCollection.call(this, isTestingWithSimulator);
        
        if ( typeof this.event.request.intent !== "undefined" ) {
            if ( typeof this.event.request.intent.slots !== "undefined" ) {
                companyNumber = retrieveCompanyNumber.call(this, this.event.request.intent.slots);
            }
        }
        path = "/company/" + companyNumber + "/officers?items_per_page=5";
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
            this.emit(':tellWithCard', outputSpeech.replace('&', "and"), "Get Officers of Company " + companyNumber, outputSpeech.replace('&', "and"), "");
        }, path);
    },
    'StoreCompany': function() {
        var companyNumber;

        let isTestingWithSimulator = false; //autofill slots when using simulator, dialog management is only supported with a device
        let filledSlots = delegateSlotCollection.call(this, isTestingWithSimulator);
        
        if ( typeof this.event.request.intent !== "undefined" ) {
            if ( typeof this.event.request.intent.slots !== "undefined" ) {
                companyNumber = retrieveCompanyNumber.call(this, this.event.request.intent.slots);
            }
        }

        path = "/company/" + companyNumber;
        getAPIData((data) => {
            var outputSpeech = "";
            if( typeof data.errors !== "undefined" ) {
                outputSpeech = "No company details were returned. Please check the company number provided";
            }
            else {
                console.log("data returned: ", data);
                console.log("Adding a new item...");
                this.attributes['contextIntent'] = 'StoreCompany';
                this.attributes['tempCompanyNumber'] = companyNumber;
                var companyName = data.company_name.replace('&', "and");

                // TODO - WHich output speech is being used here? Is response speak/listen doing it or is askWithCard?
                // Need to resolve gathering of company numbers. Tesco wasn't working ...
                // Work on recognition of certain numbers: 445790 Comes through as Four For Five Seven Nine Oh Expand model with exceptions?
                // Create outputSpeech helper method which cleans all output speech to avoid bad SSML error.

                
                outputSpeech += "Company found for number " + companyNumber + " is " + data.company_name + ". Is this the company you want to save?";
                // this.response.shouldEndSession(true);
                this.response.speak(outputSpeech).listen(outputSpeech, 'Say yes to save the company or no to quit.');
                // this.emit(':responseReady');
                this.emit(':askWithCard', "Company found for number " + companyNumber.replace(/(.{1})/g,"$1 ") + " is " + companyName + ". Is this the company you want to save?", "Is this the company you want to save?", "Check Company to Store", "Company found for number " + companyNumber + " is " + companyName + ".");
            }
        }, path);
    },
    'MyCompanyDetails': function() {
        var companyNumber = this.attributes['companyNumber'];

        path = "/company/" + companyNumber;
        getAPIData((data) => {
            var outputSpeech = "";
            
            if( typeof data.errors !== "undefined" ) {
                outputSpeech = "No company details were returned. Please try to store your company number again.";
            }
            else {
                console.log("data returned: ", data);
                outputSpeech += "Your company: " + data.company_name + ", created on " + new Date(data.date_of_creation).toDateString() + ".";
                outputSpeech += ' Next accounts are due: ' + new Date(data.accounts.next_accounts.due_on).toDateString() + ".";
                outputSpeech += ' Next confirmation statement is due: ' + new Date(data.confirmation_statement.next_due).toDateString() + ".";
            }
            this.emit(':tellWithCard', outputSpeech.replace('&', "and"), "Get Company " + companyNumber, outputSpeech.replace('&', "and"), "");
        }, path);
    },
    'MyCompanyCS': function() {
        var companyNumber = this.attributes['companyNumber'];

        path = "/company/" + companyNumber;
        getAPIData((data) => {
            var outputSpeech = "";
            if( typeof data.errors !== "undefined" ) {
                outputSpeech = "No company details were returned. Please check the company number provided";
            }
            else {
                console.log("data returned: ", data);
                outputSpeech += "Your stored company: " + data.company_name + ".";
                outputSpeech += ' Next confirmation statement is due: ' + new Date(data.confirmation_statement.next_due).toDateString() + ".";                
            }
            this.emit(':tellWithCard', outputSpeech.replace('&', "and"), "My Company Confirmation Statement", outputSpeech.replace('&', "and"), "");
        }, path);
    },
    'MyCompanyAccounts': function() {
        var companyNumber = this.attributes['companyNumber'];

        path = "/company/" + companyNumber;
        getAPIData((data) => {
            var outputSpeech = "";
            if( typeof data.errors !== "undefined" ) {
                outputSpeech = "No company details were returned. Please check the company number provided";
            }
            else {
                console.log("data returned: ", data);
                outputSpeech += "Your stored company: " + data.company_name + ".";
                outputSpeech += ' Next accounts are due: ' + new Date(data.accounts.next_accounts.due_on).toDateString() + ".";
            }
            this.emit(':tellWithCard', outputSpeech.replace('&', "and"), "My Company Accounts", outputSpeech.replace('&', "and"), "");
        }, path);
    },
    'MyFilingHistory': function() {
        var companyNumber = this.attributes['companyNumber'];

        path = "/company/" + companyNumber + "/filing-history?items_per_page=3";
        getAPIData((data) => {
            var outputSpeech = "";
            if( typeof data.errors !== "undefined" ) {
                outputSpeech = "No filing history for this company was returned.";
            }
            else if ( typeof data.items !== "undefined" ) {
                outputSpeech += "There have been " + data.total_count + " filings for this company: ";
                if (data.total_count > 3) {
                    outputSpeech += "Here are the latest three. ";
                }
                for (var i = 0; i < data.items.length; i++) {
                    var filingNum = i+1;
                    outputSpeech += "Filing " + filingNum + ": ";
                    outputSpeech += "Date: " + data.items[i].date + ". ";
                    outputSpeech += "Category: " + data.items[i].category + ". ";
                    outputSpeech += "Form type: " + data.items[i].type + ". ";
                    outputSpeech += "Description: " + data.items[i].description.replace(/-/g, " ") + ". ";
                }         
            }
            this.emit(':tellWithCard', outputSpeech.replace('&', "and"), "My Company Filing History", outputSpeech.replace('&', "and"), "");
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
    'AMAZON.YesIntent': function() {
        console.log("this is: " + this);
        if (this.attributes['contextIntent'] === 'StoreCompany') {
            this.attributes['companyNumber'] = this.attributes['tempCompanyNumber'];

            // Clean up temporary saved items.
            this.attributes['contextIntent'] = 'default';
            this.attributes['tempCompanyNumber'] = 'default';
            this.emit(':tellWithCard', "Thank you, your company has been saved.", "Company Stored", "Thank you, your company has been saved.");
        }
    },
    'AMAZON.NoIntent': function() {
        this.emit(':tellWithCard', "Okay, company not saved");
    },
    'Unhandled': function () {
        this.emit(':tell', "The service threw an error");
    }
};

function delegateSlotCollection(shouldFillSlotsWithTestData) {
    console.log("in delegateSlotCollection");
    console.log("current dialogState: " + this.event.request.dialogState);

    // This will fill any empty slots with canned data provided in defaultData
    // and mark dialogState COMPLETED.
    // USE ONLY FOR TESTING IN THE SIMULATOR.
    if (shouldFillSlotsWithTestData) {
        // let filledSlots = fillSlotsWithTestData.call(this, defaultData);
        this.event.request.dialogState = "COMPLETED";
    }

    if (this.event.request.dialogState === "STARTED") {
        console.log("in STARTED");
        console.log(JSON.stringify(this.event));
        var updatedIntent=this.event.request.intent;
        // optionally pre-fill slots: update the intent object with slot values 
        // for which you have defaults, then return Dialog.Delegate with this 

        return this.emit(":delegate", updatedIntent);
    } else if (this.event.request.dialogState !== "COMPLETED") {
        console.log("in not completed");

        return this.emit(":delegate", this.event.request.intent);
    } else {
        console.log("in completed");
        // Dialog is now complete and all required slots should be filled,
        // so call your normal intent handler.
        return this.event.request.intent.slots;
    }
}

function retrieveCompanyNumber(slots) {
    console.log("slots received: ", slots);
    var companyNumber = "";
    if ( typeof slots.companyNumber.value !== "undefined" ) {
        companyNumber = this.event.request.intent.slots.companyNumber.value;
    }
    if ( typeof slots.companyNumberOpt.value !== "undefined" ) {
        var slotOpt = this.event.request.intent.slots.companyNumberOpt.value;
        if( slotOpt.match(/^(NI|SC|OC)$/) ) {
            companyNumber = slotOpt + companyNumber;
        }
    }
    if (companyNumber.length !== 0) {
        companyNumber = companyNumber.toUpperCase().padStart(8, "0");
    }
    else {
        companyNumber = "";
    }
    return companyNumber;
}

function getAPIData(callback, path) {
    var options = {
        host: 'api.companieshouse.gov.uk',
        auth: process.env.api_key,
        path: path,
        method: 'GET'
    };
    console.log("Path: ", path);

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