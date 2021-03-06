var Alexa = require('alexa-sdk');
var AWS = require('aws-sdk');
var http = require('https');

var LIQUIDATED = 'liquidation';
var DISSOLVED = 'dissolved';

// Need to account for CS (CS002402) and SO (SO306638) companies later.

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
        var outputSpeech = 'Welcome to Companies House Alexa Skill. All you need is a company incorporation number. ';
        outputSpeech += 'You can ask Companies House for any company details, officers, filing history or perhaps ask to store the company number for later. ';
        outputSpeech += 'Please provide a company number to hear details of.';
        this.emit(':askWithCard', outputSpeech, 'Welcome to Companies House', outputSpeech, '');
    },
    'GetCompany': function() {
        var companyNumber;
        var path;

        let isTestingWithSimulator = false; //autofill slots when using simulator, dialog management is only supported with a device
        let filledSlots = delegateSlotCollection.call(this, isTestingWithSimulator);

        if (typeof this.event.request.intent !== "undefined") {
            if (typeof this.event.request.intent.slots !== "undefined") {
                companyNumber = retrieveCompanyNumber.call(this, this.event.request.intent.slots);
                if (companyNumber.length > 8) {
                    var outputSpeech = 'Company number: ' + companyNumber + ' is longer than 8 characters. Please check the company number provided.';
                    this.emit(':tellWithCard', outputSpeech, 'Company number too long', outputSpeech, '');
                    return;
                }
            }
        }
        path = "/company/" + companyNumber;
        getAPIData((data) => {
            var outputSpeech = "";
            if (typeof data.errors !== "undefined") {
                outputSpeech = "No company details were returned. Please check the company number provided";
            } else {
                console.log("data returned: ", data);
                outputSpeech += data.company_name + ", created on " + new Date(data.date_of_creation).toDateString() + ". ";
                outputSpeech += "Company status: " + data.company_status + ". ";
                outputSpeech += addAccountsOutputInfo(data);
                outputSpeech += addConfirmationStatementOutputInfo(data);
            }
            this.emit(':tellWithCard', outputSpeech.replace('&', "and"), "Get Company " + companyNumber, outputSpeech.replace('&', "and"), "");
        }, path);
    },
    'GetOfficers': function() {
        var companyNumber;
        var path;

        let isTestingWithSimulator = false; //autofill slots when using simulator, dialog management is only supported with a device
        let filledSlots = delegateSlotCollection.call(this, isTestingWithSimulator);

        if (typeof this.event.request.intent !== "undefined") {
            if (typeof this.event.request.intent.slots !== "undefined") {
                companyNumber = retrieveCompanyNumber.call(this, this.event.request.intent.slots);
                if (companyNumber.length > 8) {
                    var outputSpeech = 'Company number: ' + companyNumber + ' is longer than 8 characters. Please check the company number provided.';
                    this.emit(':tellWithCard', outputSpeech, 'Company number too long', outputSpeech, '');
                    return;
                }
            }
        }
        path = "/company/" + companyNumber + "/officers?items_per_page=5";
        getAPIData((data) => {
            var outputSpeech = "";

            if (typeof data.errors !== "undefined") {
                outputSpeech = "No company details were returned. Please check the company number provided";
            } else if (typeof data.items !== "undefined") {
                console.log("data returned: ", data);
                outputSpeech += "There have been " + data.total_results + " officers of company number: " + companyNumber + ". ";
                if (data.active_count > 5) {
                    outputSpeech += "There are " + data.active_count + " active officers. Here are the first five returned. ";
                } else {
                    outputSpeech += "There are " + data.active_count + " active officers. ";
                }
                for (var i = 0; i < data.items.length; i++) {
                    var officerNum = i + 1;
                    outputSpeech += "Officer " + officerNum + ". ";
                    outputSpeech += "Name: " + data.items[i].name + ". ";
                    outputSpeech += "Role: " + data.items[i].officer_role + ". ";
                    outputSpeech += "Appointed: " + data.items[i].appointed_on + ". ";
                }
            } else {
                outputSpeech = "No officer details were returned. Please check the company number provided";
            }
            this.emit(':tellWithCard', outputSpeech.replace('&', "and"), "Get Officers of Company " + companyNumber, outputSpeech.replace('&', "and"), "");
        }, path);
    },
    'StoreCompany': function() {
        var companyNumber;

        let isTestingWithSimulator = false; //autofill slots when using simulator, dialog management is only supported with a device
        let filledSlots = delegateSlotCollection.call(this, isTestingWithSimulator);

        if (typeof this.event.request.intent !== "undefined") {
            if (typeof this.event.request.intent.slots !== "undefined") {
                companyNumber = retrieveCompanyNumber.call(this, this.event.request.intent.slots);
                if (companyNumber.length > 8) {
                    var outputSpeech = 'Company number: ' + companyNumber + ' is longer than 8 characters. Please check the company number provided.';
                    this.emit(':tellWithCard', outputSpeech, 'Company number too long', outputSpeech, '');
                    return;
                }
            }
        }

        path = "/company/" + companyNumber;
        getAPIData((data) => {
            var outputSpeech = "";
            if (typeof data.errors !== "undefined") {
                outputSpeech = "No company details were returned. Please check the company number provided";
            } else {
                console.log("data returned: ", data);
                this.attributes['contextIntent'] = 'StoreCompany';
                this.attributes['tempCompanyNumber'] = companyNumber;
                var companyName = data.company_name.replace('&', "and");

                outputSpeech += "Company found for number " + companyNumber + " is " + data.company_name + ". Is this the company you want to save?";
                this.response.speak(outputSpeech).listen(outputSpeech, 'Say yes to save the company or no to quit.');
                this.emit(':askWithCard', "Company found for number " + companyNumber.replace(/(.{1})/g, "$1 ") + " is " + companyName + ". Is this the company you want to save?", "Is this the company you want to save?", "Check Company to Store", "Company found for number " + companyNumber + " is " + companyName + ".");
            }
        }, path);
    },
    'MyCompanyDetails': function() {
        var companyNumber = this.attributes['companyNumber'];

        path = "/company/" + companyNumber;
        getAPIData((data) => {
            var outputSpeech = "";

            if (typeof data.errors !== "undefined") {
                outputSpeech = "No company details were returned. Please try to store your company number again.";
            } else {
                console.log("data returned: ", data);
                outputSpeech += "Your company: " + data.company_name + ", created on " + new Date(data.date_of_creation).toDateString() + ". ";
                outputSpeech += addAccountsOutputInfo(data);
                outputSpeech += addConfirmationStatementOutputInfo(data);
            }
            this.emit(':tellWithCard', outputSpeech.replace('&', "and"), "Get Company " + companyNumber, outputSpeech.replace('&', "and"), "");
        }, path);
    },
    'MyCompanyCS': function() {
        var companyNumber = this.attributes['companyNumber'];

        path = "/company/" + companyNumber;
        getAPIData((data) => {
            var outputSpeech = "";
            if (typeof data.errors !== "undefined") {
                outputSpeech = "No company details were returned. Please check the company number provided";
            } else {
                console.log("data returned: ", data);
                outputSpeech += "Your stored company: " + data.company_name + ". ";
                outputSpeech += addConfirmationStatementOutputInfo(data);
            }
            this.emit(':tellWithCard', outputSpeech.replace('&', "and"), "My Company Confirmation Statement", outputSpeech.replace('&', "and"), "");
        }, path);
    },
    'MyCompanyAccounts': function() {
        var companyNumber = this.attributes['companyNumber'];

        path = "/company/" + companyNumber;
        getAPIData((data) => {
            var outputSpeech = "";
            if (typeof data.errors !== "undefined") {
                outputSpeech = "No company details were returned. Please check the company number provided";
            } else {
                console.log("data returned: ", data);
                outputSpeech += "Your stored company: " + data.company_name + ". ";
                outputSpeech += addAccountsOutputInfo(data);
            }
            this.emit(':tellWithCard', outputSpeech.replace('&', "and"), "My Company Accounts", outputSpeech.replace('&', "and"), "");
        }, path);
    },
    'MyFilingHistory': function() {
        var companyNumber = this.attributes['companyNumber'];

        path = "/company/" + companyNumber + "/filing-history?items_per_page=3";
        getAPIData((data) => {
            var outputSpeech = "";
            if (typeof data.errors !== "undefined") {
                outputSpeech = "No filing history for this company was returned.";
            } else if (typeof data.total_count === 0) {
                outputSpeech = "No filings found for company number: " + companyNumber + ". Please check the company number provided. ";
            } else if (typeof data.items !== "undefined") {
                console.log("data returned: ", data);
                outputSpeech += "There have been " + data.total_count + " filings for stored company number: " + companyNumber + ". ";
                if (data.total_count > 3) {
                    outputSpeech += "Here are the latest three. ";
                }
                for (var i = 0; i < data.items.length; i++) {
                    var filingNum = i + 1;
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
    'GetFilingHistory': function() {
        var companyNumber;

        let isTestingWithSimulator = false; //autofill slots when using simulator, dialog management is only supported with a device
        let filledSlots = delegateSlotCollection.call(this, isTestingWithSimulator);

        if (typeof this.event.request.intent !== "undefined") {
            if (typeof this.event.request.intent.slots !== "undefined") {
                companyNumber = retrieveCompanyNumber.call(this, this.event.request.intent.slots);
                if (companyNumber.length > 8) {
                    var outputSpeech = 'Company number: ' + companyNumber + ' is longer than 8 characters. Please check the company number provided.';
                    this.emit(':tellWithCard', outputSpeech, 'Company number too long', outputSpeech, '');
                    return;
                }
            }
        }

        path = "/company/" + companyNumber + "/filing-history?items_per_page=3";
        getAPIData((data) => {
            var outputSpeech = "";
            if (typeof data.errors !== "undefined") {
                outputSpeech = "No filing history for this company was returned.";
            } else if (typeof data.total_count === 0) {
                outputSpeech = "No filings found for company number: " + companyNumber + ". Please check the company number provided. ";
            } else if (typeof data.items !== "undefined") {
                console.log("data returned: ", data);
                outputSpeech += "There have been " + data.total_count + " filings for company number: " + companyNumber + ". ";
                if (data.total_count > 3) {
                    outputSpeech += "Here are the latest three. ";
                }
                for (var i = 0; i < data.items.length; i++) {
                    var filingNum = i + 1;
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
        if (this.attributes['contextIntent'] === 'StoreCompany') {
            this.attributes['companyNumber'] = this.attributes['tempCompanyNumber'];

            // Clean up temporary saved items.
            this.attributes['contextIntent'] = 'default';
            this.attributes['tempCompanyNumber'] = 'default';
            this.emit(':tellWithCard', "Thank you, your company has been saved.", "Company Stored", "Thank you, your company has been saved.");
        }
    },
    'AMAZON.NoIntent': function() {
        if (this.attributes['contextIntent'] === 'StoreCompany') {
            this.emit(':tellWithCard', "Okay, company not saved");
        }
    },
    'Unhandled': function() {
        this.emit(':tell', "The service threw an error");
    }
};

function delegateSlotCollection(shouldFillSlotsWithTestData) {

    // This will fill any empty slots with canned data provided in defaultData
    // and mark dialogState COMPLETED.
    // USE ONLY FOR TESTING IN THE SIMULATOR.
    if (shouldFillSlotsWithTestData) {
        // let filledSlots = fillSlotsWithTestData.call(this, defaultData);
        this.event.request.dialogState = "COMPLETED";
    }

    if (this.event.request.dialogState === "STARTED") {
        var updatedIntent = this.event.request.intent;
        if (typeof this.event.request.intent !== "undefined") {
            if (typeof this.event.request.intent.slots !== "undefined") {
                companyNumber = retrieveCompanyNumber.call(this, this.event.request.intent.slots);
                console.log("Slots are present, set to complete");
                this.event.request.dialogState = "COMPLETED";
                return this.event.request.intent.slots;
            }
        }
        // optionally pre-fill slots: update the intent object with slot values 
        // for which you have defaults, then return Dialog.Delegate with this 

        return this.emit(":delegate", updatedIntent);
    } else if (this.event.request.dialogState === "IN_PROGRESS") {
        var updatedIntent = this.event.request.intent;
        if (typeof this.event.request.intent !== "undefined") {
            if (typeof this.event.request.intent.slots !== "undefined") {
                companyNumber = retrieveCompanyNumber.call(this, this.event.request.intent.slots);
                this.event.request.dialogState = "COMPLETED";
                return this.event.request.intent.slots;
            }
        }
        // optionally pre-fill slots: update the intent object with slot values 
        // for which you have defaults, then return Dialog.Delegate with this 

        return this.emit(":delegate", updatedIntent);
    } else if (this.event.request.dialogState !== "COMPLETED") {
        var updatedIntent = this.event.request.intent;
        if (typeof this.event.request.intent !== "undefined") {
            if (typeof this.event.request.intent.slots !== "undefined") {
                companyNumber = retrieveCompanyNumber.call(this, this.event.request.intent.slots);
                this.event.request.dialogState = "COMPLETED";
                return this.event.request.intent.slots;
            }
        }
        return this.emit(":delegate", this.event.request.intent);
    } else {
        // Dialog is now complete and all required slots should be filled,
        // so call your normal intent handler.
        return this.event.request.intent.slots;
    }
}

function resolveSlotValue(value) {
    if (typeof value === 'undefined') {

        return '';
    } else if (value.length > 1) {
        if (value.match(/^(to|too)$/)) return '2';
        if (value.match(/^(fore|for)$/)) return '4';
        if (value.match(/^(oh|Oh|OH|O)$/)) return '0';

        return '';
    } else if (value.match(/^([0-9])$/)) {
        return value;
    } else {
        return '';
    }
}

function retrieveCompanyNumber(slots) {
    console.log("slots received: ", slots);
    var companyNumber = "";
    companyNumber += resolveSlotValue(slots.numbersWithExceptionsOne.value);
    companyNumber += resolveSlotValue(slots.numbersWithExceptionsTwo.value);
    companyNumber += resolveSlotValue(slots.numbersWithExceptionsThree.value);
    companyNumber += resolveSlotValue(slots.numbersWithExceptionsFour.value);
    companyNumber += resolveSlotValue(slots.numbersWithExceptionsFive.value);
    companyNumber += resolveSlotValue(slots.numbersWithExceptionsSix.value);
    companyNumber += resolveSlotValue(slots.numbersWithExceptionsSeven.value);
    companyNumber += resolveSlotValue(slots.numbersWithExceptionsEight.value);

    if (typeof slots.companyNumberOpt.value !== "undefined") {
        var slotOpt = slots.companyNumberOpt.value;
        if (slotOpt.match(/^(NI|SC|OC|CE)$/)) {
            companyNumber = slotOpt + companyNumber;
        } else if (slotOpt.match(/^(C|c|oh|Oh|OH|O|o|osi)$/)) {
            companyNumber = "OC" + companyNumber;
        }
        // Check if it's captured a digit (Despite the only values being company prefixes it still catches digits...)
        else if (slotOpt.length === 1 && slotOpt.match(/^([0-9])$/)) {
            companyNumber = slotOpt + companyNumber;
        }
    }

    if (companyNumber.length !== 0) {
        companyNumber = companyNumber.toUpperCase().padStart(8, "0");

        // Checking for whether the second slot was a C - for some reason despite it not being a valid value 
        // it still comes through as a slot type instead of coming through as the Opt /NI|SC|OC|CE/ slot.
        if (typeof slots.numbersWithExceptionsOne.value !== "undefined" && typeof slots.numbersWithExceptionsTwo.value !== "undefined") {
            var slotOne = slots.numbersWithExceptionsOne.value;
            var slotTwo = slots.numbersWithExceptionsTwo.value;
            if (slotTwo.match(/^(C|c)$/)) {
                if (slotOne.match(/^(oh|Oh|OH|O)$/)) {
                    companyNumber = 'OC' + companyNumber.substring(2);
                } else if (slotOne.match(/^(S|s)$/)) {
                    companyNumber = 'SC' + companyNumber.substring(2);
                }
            }
        }

    } else {
        companyNumber = "";
    }

    console.log("Resolved company number: " + companyNumber);
    return companyNumber;
}

function addAccountsOutputInfo(data) {
    var outputSpeech = '';
    if (typeof data.accounts !== "undefined") {
        if (data.company_status === DISSOLVED || data.company_status === LIQUIDATED) {
            outputSpeech += ' Last accounts were made up to: ' + new Date(data.accounts.last_accounts.made_up_to).toDateString() + ". ";
        } else {
            outputSpeech += ' Next accounts are due: ' + new Date(data.accounts.next_accounts.due_on).toDateString() + ". ";
        }
    }

    return outputSpeech;
}

function addConfirmationStatementOutputInfo(data) {
    var outputSpeech = '';
    if (data.company_status !== DISSOLVED || data.company_status !== LIQUIDATED) {
        if (typeof data.confirmation_statement !== "undefined") {
            outputSpeech += ' Next confirmation statement is due: ' + new Date(data.confirmation_statement.next_due).toDateString() + ".";
        }
    }

    return outputSpeech;
}

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