var CKANEXT = CKANEXT || {};
CKANEXT.MODERATEDEDITS = CKANEXT.MODERATEDEDITS || {};

(function(ns, $){
    // initialisation function, called when the page has finished loading
    //
    // Args:
    //     packageName (str): the name of the package being edited
    //     revisionListURL (str): URL that will return a JSON object with the list of revisions
    //     revisionDataURL (str): URL that will return a JSON object with revision data
    ns.init = function(packageName, revisionListURL, revisionDataURL){
        // named constants
        ns.STANDARD_FIELD = 0;
        ns.RESOURCES_FIELD = 1;
        ns.EXTRAS_FIELD = 2;
        ns.REVISION_LIST_MAX_LENGTH = 10;

        // values received from plugin
        ns.packageName = packageName;
        ns.revisionListURL = revisionListURL;
        ns.revisionDataURL = revisionDataURL;

        // find out if the current user is a moderator by looking for the
        // option to change the package state
        ns.isModerator = $('#state').length > 0;
        // enable the sidebar which is where the revision list goes by default
        $('body').removeClass("hide-sidebar");
        // Add the 'resources added' and 'resources removed' sections
        var resourcesAdded = '<div id="resources-added">' +
            '<h3>Resources Added</h3>' +
            '<table class="flexitable"><tbody></tbody></table></div>';
        $("div.instructions.basic").prev("p.flexitable").before(resourcesAdded);
        var resourcesRemoved = '<div id="resources-removed">' +
            '<h3>Resources Removed</h3>' +
            '<table class="flexitable"><tbody></tbody></table></div>';
        $("#resources-added").next("p").after(resourcesRemoved);
        // resources field name regex
        ns.fieldNameRegex = /^(\S+)__(\d+)__(\S+)$/; 

        // default active revision is the latest one
        ns.activeRevision = 0;
        ns.activeRevisionID = null;
        ns.revisions = null;
        ns.lastApproved = 0;
        ns.formInputs = {}
        ns.formInputTypes = {};
        ns.extrasFormInputs = [];
        ns.shadows = {};
        ns.shadowResourceNumbers = {};
        ns.shadowExtras = {};

        // display revision info box and list
        ns.revisionList();
        // add click handler for 'click here for more information' link in info box
        $('a#revision-show-mod-info').click(ns.showModInfoClicked);
        // add click handler for 'select latest revision' link in info box
        $('a#revision-select-latest').click(function(){
            ns.changeRevision(ns.lastApproved);
        });
        // add new button for saving a moderated version
        if(ns.isModerator){
            var saveModHtml = ' <input name="save" type="submit" ' +
                'value="Approve" />';
            $('.submit input[name="save"]').after(saveModHtml);
        }
        // change default preview/submit buttons to match style
        $('.submit input[name="preview"]').button(); 
        $('.submit input[name="save"]').button(); 
        // disable moveup/movedown functionality on resources form for now
        $('a.moveUp').remove();
        $('a.moveDown').remove();
        // fix width of log message
        $('#log_message').removeClass("short");

        // set speed for JQuery fades (in milliseconds)
        ns.fadeTime = 500;
        // add a diff-match-patch object to get a diff of textareas
        ns.dmp = new diff_match_patch();
        ns.dmp.Diff_Timeout = 1;
    };

    // if the active revision is not approved,
    // return the index of the latest approved revision for this package
    //
    // if active revision is approved, or there are no other (approved) revisions,
    // return the active revision index.
    ns.lastApprovedRevision = function(){
        var lastApproved = ns.activeRevision;

        if(ns.revisions && ns.revisions.length > 0){
            if(!ns.revisions[ns.activeRevision].approved){
                // get the latest approved revision
                for(var i in ns.revisions){
                    if(ns.revisions[i].approved){
                        lastApproved = i;
                    }
                }
            }
        }
        
        return lastApproved;
    };

    // display the revision information box
    ns.revisionInfo = function(){
        if(ns.isModerator){
            $('#revision-info-moderator').fadeIn(ns.fadeTime);
        }
        else{
            $('#revision-info-moderator').fadeOut(ns.fadeTime);
        }

        ns.lastApproved = ns.lastApprovedRevision()
        if(ns.activeRevision != ns.lastApproved){
            $('#revision-info-link-to-latest').fadeIn(ns.fadeTime);
        }
        else{
            $('#revision-info-link-to-latest').fadeOut(ns.fadeTime);
        }

        // test for both to decide whether to hide the whole revision info box or not
        if(ns.isModerator || (ns.activeRevision != ns.lastApproved)){
            $('#revision-info').fadeIn(ns.fadeTime);
        }
        else{
            $('#revision-info').fadeOut(ns.fadeTime);
        }
    };

    // callback for 'click here to find out more' link for moderators
    ns.showModInfoClicked = function(){
        $('#revision-show-mod-info').fadeOut(ns.fadeTime);
        $('#revision-moderator-info').slideToggle();
    };

    // change revision
    ns.changeRevision = function(index){
        ns.activeRevision = index;
        ns.revisionList();
    };

    // display the revision list
    // save the list of revisions for this package to this.revisions
    // save the revision ID and log message for the current active revision
    ns.revisionList = function(){
        var success = function(response){
            if(response.length == 0){
                $('#revision-list-msg').empty().replaceWith("No previous revisions found.");
            }
            else{
                var html = "";
                for(var i in response){
                    var revisionDate = response[i].timestamp;

                    html += '<li ';
                    // set active/inactive classes
                    if(i == ns.activeRevision){
                        html += 'id="revision-active" ';
                        // save the revision ID and log message
                        ns.activeRevisionID = response[i].revision_id;
                    }
                    // set approved class
                    if(response[i].approved){
                        html += 'class="revision-approved"';
                    }
                    else{
                        html += 'class="revision-not-approved"';
                    }
                    html += '>';

                    if(i == ns.activeRevision){
                        var commitMessage = response[i].message;
                        if(commitMessage === ""){
                            commitMessage = "There was no commit message for this revision";
                        }
                        html += '<span id="revision-active-text">' + revisionDate +  
                                '</span>' +
                                '<div class="revision-list-buttons">' +
                                '<button id="revision-replace-all"' + 
                                ' title="Replace all fields with values from this revision"></button>' +
                                '<button id="revision-toggle-info"' + 
                                ' title="Display the commit message for this revision"></button>' +
                                '</div>' +
                                '<div id="revision-commit-message">' + commitMessage + '</div>' +
                                '<div id="revision-replace-all-warning"' +
                                ' title="Replace all fields with values from this revision?">' +
                                'This action will replace any changes that you have made to ' +
                                'the package edit form with the values from this revision.' +
                                '</div>';
                    }
                    else{
                        html += '<a id="revision-' + i.toString() + '" ' +
                                'class="revision-list-button">' +
                                revisionDate +
                                '</a>';
                    }
                    html += '</li>';
                }
                $('#revision-list').empty().append(html);
                // add a click handlers for revision list URLs
                $('a.revision-list-button').click(function(ev){
                    ns.changeRevision($(ev.target).attr('id').substr("revision-".length));
                });
                // add dialog for replace all confirmation box
                $('#revision-replace-all-warning').dialog({
                    autoOpen: false,
                    resizable: false,
                    modal: true,
                    buttons: {
				        "Replace all fields":function(){
                            ns.replaceAllWithShadows();
                            $(this).dialog("close");
				        },
                        Cancel:function(){
					        $(this).dialog("close");
                        }
                    }
                });
                // add button and click handler for 'replace all' button
                $('#revision-replace-all').button({
                    text: false, icons : {primary:'ui-icon-transferthick-e-w'}
                });
                $('#revision-replace-all').click(function(){
                    $('#revision-replace-all-warning').dialog('open');
                });
                // add button and click handler for info button
                $('#revision-toggle-info').button({
                    text: false, icons : {primary:'ui-icon-info'}
                });
                $('#revision-toggle-info').click(function(){
                    $('#revision-commit-message').slideToggle();
                });
            }

            // update the revision info box
            ns.revisions = response;
            ns.revisionInfo();
            // update the lists of form input fields
            ns.updateFormInputs();
            // update the shadow field values
            ns.updateShadows();
            // update extras
            ns.updateExtras();
        };

        var error = function(response){
            $('#revision-list').append("<li>Error: could not load revision list.</li>");
        };

        $.ajax({method: 'GET',
                url: ns.revisionListURL,
                dataType: 'json',
                success: success,
                error: error
        }); 
    };

    // if all fields match, highlight the active revision in green
    ns.checkAllMatch = function(){
        if($('.shadow-value').length){
            $('#revision-active').removeClass("revision-active-match");
            $('#revision-active').addClass("revision-active-nomatch");
            $('#revision-list-new-revision').fadeIn(ns.fadeTime);
        }
        else{
            $('#revision-active').removeClass("revision-active-nomatch");
            $('#revision-active').addClass("revision-active-match");
            $('#revision-list-new-revision').fadeOut(ns.fadeTime);
        }
    };

    ns.updateFormInputs = function(){
        ns.formInputs = $('#package-edit input[type=text], select[id!="state"], textarea');
        // for each form input, decide whether it should have the standard
        // shadow, or if it belongs to a special case (resources, extras, etc)
        ns.formInputTypes = {};
        ns.extrasFormInputs = [];
        $.each(ns.formInputs, function(index, value){
            var fieldsetID = $(value).closest('fieldset').attr('id');
            if(fieldsetID === 'resources'){
                var inputType = ns.RESOURCES_FIELD;
            }
            else if(fieldsetID === 'extras'){
                var inputType = ns.EXTRAS_FIELD;
                ns.extrasFormInputs.push(ns.formInputs[index]);
            }
            else{
                var inputType = ns.STANDARD_FIELD;
                if(!$(ns.formInputs[index]).next().hasClass("shadow")){
                    $(ns.formInputs[index]).after('<div class="shadow"></div>');
                }
            }
            ns.formInputTypes[$(value).attr('name')] = inputType;
        });
        // callback handler for form fields being changed
        ns.formInputs.unbind();
        ns.formInputs.change(ns.inputValueChanged);
        ns.formInputs.keyup(ns.inputValueChanged);
    };
    
    // update the values of the shadow fields to those of the active revision
    ns.updateShadows = function(){
        var success = function(data){
            ns.shadows = data;
            ns.shadowResourceNumbers = {};
            ns.shadowExtras = {};
            for(var i in data){
                // save resource number based on ID
                if((i.substr(0, "resources__".length) === "resources__") &&
                   (i.substr("resources__".length + 1) === "__id")){
                    ns.shadowResourceNumbers[data[i]] = i.charAt("resources__".length);
                }
                // save extras values by key name
                else if((i.substr(0, "extras__".length) === "extras__") &&
                        (i.substr("extras__".length + 1) === '__key')){
                    var value = data["extras__" + i.charAt("extras__".length) + "__value"]; 
                    var niceKey = ns.urlFriendly(data[i])
                    ns.shadowExtras[niceKey] = new ns.Extra(data[i], value);
                }
            }
            ns.allMatchesAndShadows();
        };

        $.ajax({method: 'GET',
                url: ns.revisionDataURL + "/" + ns.activeRevisionID,
                dataType: 'json',
                success: success
        }); 
    };

    // input value changed, update match/shadow status
    ns.checkField = function(field){
        var fieldName = $(field).attr("name");
        var inputValue = $(field).val();
        var shadowValue = ns.shadows[fieldName];

        // ignore - empty fields to enter resources or extra keys/values
        if(typeof shadowValue === "undefined"){
            return;
        }

        if(ns.formInputTypes[fieldName] == ns.STANDARD_FIELD){
            ns.standardFieldChanged(field, fieldName, inputValue, shadowValue);
        }
        else if(ns.formInputTypes[fieldName] == ns.RESOURCES_FIELD){
            ns.resourcesFieldChanged(field, fieldName);
        }
        else if(ns.formInputTypes[fieldName] == ns.EXTRAS_FIELD){
            ns.extrasFieldChanged(field, fieldName);
        }

        ns.checkAllMatch();
    };

    // show either shadows or matches for all fields
    ns.allMatchesAndShadows = function(){
        $.each(ns.formInputs, function(index, value){
            ns.checkField(value);
        });
        ns.resourcesAddedOrRemoved();
        ns.extrasAddedOrRemoved();
        ns.checkAllMatch();
    };

    // replace all field values with current shadow values
    ns.replaceAllWithShadows = function(){
        $.each(ns.formInputs, function(index, value){
            var fieldName = $(value).attr('name');
            var shadowValue = ns.shadows[fieldName];

            if(ns.formInputTypes[fieldName] ==
               ns.STANDARD_FIELD){
                if(shadowValue != undefined){
                    ns.replaceWithShadow(fieldName);
                }
            }
        });
        ns.replaceAllResourcesWithShadows();
        ns.extrasReplaceAllWithShadows();
    };

    // callback for key pressed in an edit box (input, textarea)
    ns.inputValueChanged = function(e){
        ns.checkField(e.target);
    };

    // when comparing fields, ignore differences in line endings between
    // different platforms (eg: \r\n vs \n).
    //
    // this function makes sure all line endings a given string are \n.
    ns.normaliseLineEndings = function(input){
        if(input){
            var reNewline = /\u000d[\u000a\u0085]|[\u0085\u2028\u000d\u000a]/g;
            var nl = '\u000a'; // LF
            return input.replace(reNewline, nl);
        }
        return "";
    };

    // return url friendly version of a string
    ns.urlFriendly = function(string){
        return string.toLowerCase() // change everything to lowercase
            .replace(/^\s+|\s+$/g, "") // trim leading and trailing spaces		
            .replace(/[_|\s]+/g, "-") // change all spaces and underscores to a hyphen
            .replace(/[^a-z0-9-]+/g, "") // remove all non-alphanumeric characters except the hyphen
            .replace(/[-]+/g, "-") // replace multiple instances of the hyphen with a single instance
            .replace(/^-+|-+$/g, ""); // trim leading and trailing hyphens				
    };

    // ------------------------------------------------------------------------ 
    // Standard Fields
    // ------------------------------------------------------------------------ 

    // replace field value with current shadow values
    ns.replaceWithShadow = function(fieldName){
        var shadowValue = ns.shadows[fieldName];
        var field = $('[name=' + fieldName + ']');
        field.val(shadowValue);
        ns.checkField(field[0]);
    };

    // click handler for 'copy value to field' button in shadow area
    ns.copyValueClicked = function(e){
        var fieldName = $(this).attr('id').substr("shadow-replace-".length);
        ns.replaceWithShadow(fieldName);
    };

    // show match or shadow for standard form inputs (input, textarea, select)
    ns.standardFieldChanged = function(field, fieldName, inputValue, shadowValue){
        inputValue = ns.normaliseLineEndings(inputValue);
        shadowValue = ns.normaliseLineEndings(shadowValue);

        if(inputValue === shadowValue){
            // fields match, so just set css style
            $(field).addClass("revision-match");
            $(field).next("div").fadeOut(ns.fadeTime, function(){
                $(field).next("div").empty();
                ns.checkAllMatch();
            });
        }
        else{
            // fields don't match - display shadow
            $(field).removeClass("revision-match");
            $(field).next("div").empty();

            // different type of shadow depending on input type
            var shadow = '<div class="shadow-value">';
            if(field.nodeName.toLowerCase() === "input"){
                shadow += shadowValue;
            }
            else if(field.nodeName.toLowerCase() === "textarea"){
                var d = ns.dmp.diff_main(inputValue, shadowValue);
                ns.dmp.diff_cleanupSemantic(d);
                shadow += ns.dmp.diff_prettyHtml(d);
            }
            else if(field.nodeName.toLowerCase() === "select"){
                // for selects, we want to display the text for the appropriate
                // option rather than the value
                shadow += $(field).children('option[value='+shadowValue+']').text();
            }
            shadow += '</div>';
            $(field).next("div").append(shadow);
            
            // add the 'copy to field' button
            //
            // if the revision value was an empty string, display a different message
            // on the button
            var button = '<button type="button" id="shadow-replace-' + fieldName + '">' +
                         'Copy value to field</button>'
            if($.trim(shadowValue) === ""){
                $(field).next("div").find(".shadow-value").append("[Empty]");
                button = button.replace('Copy value to field', 'Clear this field');
            }
            $(field).next("div").append(button); 
            $('button#shadow-replace-' + fieldName).click(ns.copyValueClicked);
            $('button#shadow-replace-' + fieldName).button({
                icons : {primary:'ui-icon-arrowthick-1-n'}
            });

            $(field).next("div").fadeIn(ns.fadeTime);
        }
    };

    // ------------------------------------------------------------------------ 
    // Resources Fields
    // ------------------------------------------------------------------------ 

    // replace a row in the resources table with its current shadow values
    ns.replaceResourceWithShadow = function(rID){
        var shadowNumber = ns.shadowResourceNumbers[rID];
        ns.replaceWithShadow('resources__' + shadowNumber + '__url');
        ns.replaceWithShadow('resources__' + shadowNumber + '__format');
        ns.replaceWithShadow('resources__' + shadowNumber + '__description');
    };

    // replace all rows in the resources table with its current shadow values
    ns.replaceAllResourcesWithShadows = function(){
        var fieldset = $('#resources');

        // replace edited rows
        rows = fieldset.find("table").first().find("tbody").find("tr");
        for(var i = 0; i < rows.length; i++){
            if($(rows[i]).hasClass("resources-shadow")){
                var rID = $(rows[i]).attr('id').substr("resources-shadow-".length);
                ns.replaceResourceWithShadow(rID);
            }
        }

        // remove added rows
        rows = $('#resources-added').find("tr");
        for(var i = 0; i < rows.length; i++){
            if($(rows[i]).hasClass("resources-shadow")){
                $(rows[i]).remove();
            }
        }

        // add deleted rows
        rows = $('#resources-removed').find("tr");
        for(var i = 0; i < rows.length; i++){
            if($(rows[i]).hasClass("resources-shadow")){
                var rID = $(rows[i]).attr('id').substr("resources-shadow-".length);
                ns.resourcesReplaceRemoved(rID);
            }
        }
        
        ns.resourcesAddedOrRemoved();
    };

    // click handler for 'copy' button in resource shadow area
    ns.copyResourceClicked = function(e){
        var rID = $(this).attr('id').substr("resources-shadow-replace-".length);
        ns.replaceResourceWithShadow(rID);
    };

    // add a new row to the resources table
    ns.resourcesAddRow = function(url, format, description, id){
        var table = $('#resources').find('table').first();

        // create the new row
        var row = '<tr>' +
            '<td class="resource-url">' +
            '<input name="resources__0__url" type="text" class="short" ' +
            'value="' + url + '" />' +
            '</td>' +
            '<td class="resource-format">' +
            '<input name="resources__0__format" type="text" class="short" ' +
            'value="' + format + '" />' +
            '</td>' +
            '<td class="resource-description">' +
            '<input name="resources__0__description" type="text" class="medium-width" ' +
            'value="' + description + '" />' +
            '</td>' +
            '<td class="resource-hash">' +
            '<input name="resources__0__hash" type="text" class="medium-width" ' +
            '" />' +
            '</td>' +
            '<td class="resource-id">' +
            '<input name="resources__0__id" type="hidden" ' +
            'value="' + id + '" />' +
            '</td>' +
            '<td>' +
            '<div class="controls">' +
            '<a class="remove" title="Remove this row" href="#remove">' +
            'Remove Row</a>' +
            '</div>' +
            '</td>' +
            '</tr>';

        // add the new row to the resources table
        var lastRow = table.find('tbody').find('tr:last');
        if(lastRow.length){
            var addedRow = $(row).insertAfter(lastRow);
            ns.resourceSetRowNumber(addedRow, ns.resourceGetRowNumber(lastRow) + 1);
        }
        else{
            var addedRow = table.find('tbody').append(row);
            ns.resourceSetRowNumber(addedRow, 0);
        }

        var field = table.find('tr:last').find('.resource-url').find('input');
        ns.resourcesFieldChanged(field[0], field.attr('name'));
    };

    ns.resourcesReplaceRemoved = function(id){
        var n = ns.shadowResourceNumbers[id];
        ns.resourcesAddRow(ns.shadows["resources__"+n+"__url"],
                           ns.shadows["resources__"+n+"__format"], 
                           ns.shadows["resources__"+n+"__description"],
                           id);
        // set row numbers in all 'resources added' rows too
        var addedRows = $("#resources-added").find("tr");
        for(var i = 0; i < addedRows.length; i++){
            ns.resourceSetRowNumber(
                addedRows[i], ns.resourceGetRowNumber(addedRows[i]) + 1);
        }
    };

    ns.resourcesReplaceRemovedClicked = function(e){
        var rID = $(this).closest("tr").attr('id').substr("resources-shadow-".length);
        ns.resourcesReplaceRemoved(rID);
        ns.resourcesAddedOrRemoved();
    };

    ns.resourceGetRowNumber = function(tr){
        var rowNumber = $(tr).find('input').attr('name').match(ns.fieldNameRegex)[2];
        return parseInt(rowNumber, 10);
    };

    ns.resourceSetRowNumber = function(tr, num){
        $(tr).find('input').each(function(){
            $(this).attr({
                id:   $(this).attr('id').replace(ns.fieldNameRegex, "$1__" + num + "__$3"),
                name: $(this).attr('name').replace(ns.fieldNameRegex, "$1__" + num + "__$3")
            });
        });
    };

    // click handler for 'remove this row' button in resources being clicked
    ns.removeResourceClicked = function(e){
        if(confirm('Are you sure you wish to remove this row?')){
            var row = $(this).parents('tr');
            var following = row.nextAll();
            row.remove();
            following.each(function(){
                ns.resourceSetRowNumber(this, ns.resourceGetRowNumber(this) - 1);
            });
            // remove any shadow for this row
            var rID = $(this).closest("tr").find("td.resource-id").find("input").val();
            $('#resources-shadow-' + rID).remove();
            ns.resourcesAddedOrRemoved();
        }
    };

    // Called when a field in the resources area is edited. Check match/shadow status
    ns.resourcesFieldChanged = function(field, fieldName){
        // ignore the resources__N__hash field
        if(fieldName.substr(12) === "__hash"){
            return;
        }
    
        // get the row that was edited
        var row = $(field).closest("tr");
        var rowNumber = fieldName.charAt(11); // length of 'resources__'

        // need to compare resources based on ID, as their position in the table
        // can vary
        //
        // show a match if all items in the resource row are equal (not just this field)
        var rID = $('input[name="resources__' + rowNumber + '__id"]').attr('value');
        var rURL = $('input[name="resources__' + rowNumber + '__url"]').val();
        var rFormat = $('input[name="resources__' + rowNumber + '__format"]').val();
        var rDesc = $('input[name="resources__' + rowNumber + '__description"]').val();

        var shadowNumber = ns.shadowResourceNumbers[rID];
        var shadowURL = ns.shadows['resources__' + shadowNumber + '__url'];
        var shadowFormat = ns.shadows['resources__' + shadowNumber + '__format'];
        var shadowDesc = ns.shadows['resources__' + shadowNumber + '__description'];

        if((rURL === shadowURL) && (rFormat === shadowFormat) && (rDesc === shadowDesc)){
            row.find("td").addClass("revision-match-resources");
            // remove shadow if exists
            if(row.next().hasClass("resources-shadow")){
                row.next().remove();
            }
        }
        else{
            row.find("td").removeClass("revision-match-resources");
            // add shadow if doesn't already exist
            if(!row.next().hasClass("resources-shadow")){
                var shadowHtml = '<tr id="resources-shadow-' + rID + '" class="resources-shadow">' +
                    '<td class="resource-url shadow-value">' + 
                    // this hidden input tag is needed for the flexitable.js 
                    // removeRow function to work properly
                    '<input type="hidden" name="resources-shadow__' + shadowNumber + '__url" />' +
                    '<div class="shadow-value-short wordwrap">' + shadowURL + '</div>' +
                    '</td>' +
                    '<td class="resource-format shadow-value">' + 
                    '<div class="shadow-value-short wordwrap">' + shadowFormat + '</div>' +
                    '</td>' +
                    '<td class="resource-description shadow-value">' + 
                    '<div class="shadow-value-medium wordwrap">' + shadowDesc + '</div>' +
                    '</td>' +
                    '<td class="resource-hash"></td>' +
                    '<td class="resource-id"></td>' +
                    '<td><div class="controls">' +
                    '<button type="button" id="resources-shadow-replace-' +rID + '">' +
                    'Copy</button></div></td>' +
                    '</tr>';
                row.after(shadowHtml);
                $('#resources-shadow-replace-' + rID).click(ns.copyResourceClicked);
                $('#resources-shadow-replace-' + rID).button({
                    icons : {primary:'ui-icon-arrowthick-1-n'}
                });
            }
        }

        ns.checkAllMatch();
    };

    // checks for differences between the current list of resources and 
    // the shadow list
    //
    // only displays shadows for added/removed rows, edit rows are handled by the
    // resourcesFieldChanged function
    ns.resourcesAddedOrRemoved = function(){
        // get list of current resources by ID
        var resourceFields = $('#package-edit input[name^="resources__"]');
        var resourceNumbers = {};
        var numResources = 0;
        var blankIDs = [];
        for(var i = 0; i <  resourceFields.length; i++){
            var name = $(resourceFields[i]).attr('name');
            if(name.substr(12) === "__id"){
                var rID = $(resourceFields[i]).attr('value');
                if(rID){
                    resourceNumbers[rID] = name.charAt(11);
                    numResources++;
                }
                else{
                    blankIDs.push(name);
                }
            }
        }

        // check for resources added since shadow revision
        var resourcesAdded = "";
        for(var i in resourceNumbers){
            var row = $('#package-edit input[name="resources__' + 
                        resourceNumbers[i] + '__url"]').closest("tr");

            if(ns.shadowResourceNumbers[i] === undefined){
                row.find("td").removeClass("revision-match-resources");
                row.find("td").addClass("shadow-value");
                row.find("td").addClass("resources-shadow-added");
                // update input values html to match current values
                var url = $('.resource-url', row).find('input').val();
                var format = $('.resource-format', row).find('input').val();
                var desc = $('.resource-description', row).find('input').val();
                row.find(".resource-url").find("input")[0].setAttribute("value", url);
                row.find(".resource-format").find("input")[0].setAttribute("value", format);
                row.find(".resource-description").find("input")[0].setAttribute("value", desc);
                resourcesAdded += '<tr class="resources-shadow">' + row.html() + '</tr>';
                // remove any shadow for this row
                if(row.next("tr").hasClass("resources-shadow")){
                    row.next("tr").remove();
                }
                row.remove();
            }
            else{
                // make sure this is in the standard resources table
                if(row.hasClass("resources-shadow")){
                    row.find("td").addClass("revision-match-resources");
                    row.find("td").removeClass("shadow-value");
                    row.find("td").removeClass("resources-shadow-added");
                    var url = $('.resource-url', row).find('input').val();
                    var format = $('.resource-format', row).find('input').val();
                    var desc = $('.resource-description', row).find('input').val();
                    var id = $('.resource-id', row).find('input').val();
                    ns.resourcesAddRow(url, format, desc, id);
                    row.remove();
                }
            }
        }
        // move any blank rows to new 'resources added' section
        for(var i = 0; i < blankIDs.length; i++){
            var row = $('input[name="' + blankIDs[i] + '"]').closest("tr");
            resourcesAdded += '<tr>' + row.html() + '</tr>';
            row.remove();
        }
        if(resourcesAdded != ""){
            $('#resources-added').find("tbody").empty().append(resourcesAdded);
            $('#resources-added').show();
        }
        else{
            $('#resources-added').hide();
        }

        // check for resources removed since shadow revision
        var resourcesRemoved = "";
        for(var i in ns.shadowResourceNumbers){
            if(resourceNumbers[i] === undefined){
                var n = ns.shadowResourceNumbers[i];
                resourcesRemoved += '<tr class="resources-shadow" ' +
                    'id="resources-shadow-' + i + '">' +
                    '<td class="shadow-value resources-url">' +
                    '<div class="shadow-value-short wordwrap">' +
                    ns.shadows["resources__" + n + "__url"] + 
                    '</div></td>' + 
                    '<td class="shadow-value resources-format">' +
                    '<div class="shadow-value-short wordwrap">' +
                    ns.shadows["resources__" + n + "__format"] + 
                    '</div></td>' + 
                    '<td class="shadow-value resources-description">' +
                    '<div class="shadow-value-medium wordwrap">' +
                    ns.shadows["resources__" + n + "__description"] + 
                    '</div></td>' + 
                    '</td>' + 
                    '<td class="resource-hash"></td>' +
                    '<td class="resource-id"></td>' +
                    '<td><div class="controls">' +
                    '<button type="button" class="resources-shadow-replace-removed">' +
                    'Add</button></div></td>' +
                    '</tr>';
            }
        }
        if(resourcesRemoved != ""){
            $('#resources-removed').find("tbody").empty().append(resourcesRemoved);
            $('#resources-removed').show();
        }
        else{
            $('#resources-removed').find("tr").remove();
            $('#resources-removed').hide();
        }

        // add click handlers for 'remove row' buttons
        $('a.remove').unbind('click');
        $('a.remove').click(ns.removeResourceClicked);
        // add click handlers for 'Add back' buttons
        $('button.resources-shadow-replace-removed').unbind('click');
        $('button.resources-shadow-replace-removed').click(
            ns.resourcesReplaceRemovedClicked);
        $('button.resources-shadow-replace-removed').button({
            icons : {primary:'ui-icon-arrowthick-1-n'}
        });

        ns.checkAllMatch();
    };

    // ------------------------------------------------------------------------ 
    // Extras
    // ------------------------------------------------------------------------ 

    // object representing an extra
    ns.Extra = function(key, value){
        this.key = key;
        this.value = value;
    }

    // get the shadow value for the extra with the given key
    ns.extrasGetShadow = function(key){
        if(ns.shadowExtras[ns.urlFriendly(key)]){
            return ns.shadowExtras[ns.urlFriendly(key)].value;
        }
    };

    // Called when revision changes
    //
    // Make sure that a shadow div is added after each extra
    // Put the extra value in its own div
    ns.updateExtras = function(){
        for(var i = 0; i < ns.extrasFormInputs.length; i++){
            if($(ns.extrasFormInputs[i]).next().attr("type") === "checkbox"){
                $(ns.extrasFormInputs[i]).after('<div class="shadow"></div>');
                $(ns.extrasFormInputs[i]).wrap('<div class="extras-value" />');
                $(ns.extrasFormInputs[i]).closest('dd').addClass("extras-dd");
                $(ns.extrasFormInputs[i]).closest('dd').prev('dt').addClass("extras-dt");
            }
        }

        var extrasList = $('#extras').children("dl:first");

        $.each(extrasList.find('dt'), function(i, value){
            if(!$(value).hasClass("extras-dt")){
                $(value).addClass("extras-dt-blank");
            }
        });
        $.each(extrasList.find('dd'), function(i, value){
            if(!$(value).hasClass("extras-dd")){
                $(value).addClass("extras-dd-blank");
            }
        });

        if(!$('#extras-added').length){
            var blankExtras = $('.extras-dt-blank, .extras-dd-blank');
            blankExtras.remove();

            $('#extras').find('dl:first').after(
                '<div id="extras-added">' +
                '<h3>Extras Added</h3>' +
                '<dl id="extras-added-list"></dl></div>');
            $('#extras-added-list').append(blankExtras);
        }


        if(!$('#extras-removed').length){
            $('#extras-added').after(
                '<div id="extras-removed">' +
                '<h3>Extras Removed</h3>' +
                '<dl id="extras-removed-list"></dl></div>');
        }
    };


    ns.extrasReplaceAllWithShadows = function(){
        var fieldset = $('#extras');

        // replace edited extras
        extras = fieldset.find('.extras-dd');
        for(var i = 0; i < extras.length; i++){
            var shadowDiv = $(extras[i]).find('div.shadow-value');
            if(shadowDiv.length){
                var key = $(extras[i]).find('input').first().val();
                ns.extrasReplaceWithShadow(key);
            }
        }

        // remove added rows
        rows = $('#extras-added-list').find('dt');
        for(var i = 0; i < rows.length; i++){
            if($(rows[i]).hasClass('extras-dt')){
                $(rows[i]).next('dd').remove();
                $(rows[i]).remove();
            }
        }

        // add deleted extras
        rows = $('#extras-removed-list').find('dt');
        for(var i = 0; i < rows.length; i++){
            if($(rows[i]).hasClass("extras-dt")){
                var key = $(rows[i]).find('label').text();
                ns.extrasMoveRowToMain(key);
            }
        }
        
        ns.extrasAddedOrRemoved();
    };

    // replace extras field with shadow
    ns.extrasReplaceWithShadow = function(key){
        var shadowValue = ns.extrasGetShadow(key);
        var keyField = $('#extras input[value="' + key + '"]');
        var n = keyField.attr('name').charAt("extras__".length);
        var field = $('#package-edit input[name="extras__' + n + '__value"]');
        field.val(shadowValue);
        ns.checkField(field[0]);
    };

    // Called when a field in the extras area is edited
    // Check match/shadow status
    ns.extrasFieldChanged = function(field, fieldName){
        // if this isn't a saved value, ignore
        if(!$(field).parent().hasClass("extras-value")){
            return;
        }
        var inputValue = $(field).val();
        var key = $(field).parent().prev().val();
        var shadowValue = ns.extrasGetShadow(key);

        if(!shadowValue){
            return;
        }

        if(inputValue === shadowValue){
            // fields match, so just set css style
            $(field).addClass("revision-match");
            $(field).parent().next("div").fadeOut(ns.fadeTime, function(){
                $(field).parent().next("div").empty();
                ns.checkAllMatch();
            });
        }
        else{
            // fields don't match - display shadow
            $(field).removeClass("revision-match");
            var shadowDiv = $(field).parent().next("div").empty();
            var shadow = '<div class="shadow-value">' + shadowValue + '</div>';
            shadowDiv.append(shadow);
            // add the 'copy to field' button
            //
            // if the revision value was an empty string, display a different message
            // on the button
            var button = '<button type="button" class="extras-replace">' +
                         'Copy value to field</button>'
            if($.trim(shadowValue) === ""){
                shadowDiv.find(".shadow-value").append("[Empty]");
                button = button.replace('Copy value to field', 'Clear this field');
            }
            shadowDiv.append(button); 
            $('.extras-replace', shadowDiv).click(function(){
                var key = $(this).closest('dd').prev('dt').find('label').text();
                ns.extrasReplaceWithShadow(key);
            });
            $('.extras-replace').button({
                icons : {primary:'ui-icon-arrowthick-1-n'}
            });
            shadowDiv.fadeIn(ns.fadeTime);
        }

        ns.checkAllMatch();
    };

    // get the dt and dd of the extra with the given key
    ns.extrasGetRow = function(key){
        var dts = $('#extras').find('dt');
        for(var i = 0; i < dts.length; i++){
            if($(dts[i]).find('label').text() === key){
                var row = $(dts[i]).add($(dts[i]).next('dd'));
                return row;
            }
        }
    };

    // return true if there is an extra in the main list of extras with the given key
    ns.extrasIsInMain = function(key){
        var dts = $('#extras').find('dl:first').find('dt');
        for(var i = 0; i < dts.length; i++){
            if($(dts[i]).find('label').text() === key){
                return true;
            }
        }
        return false;
    };

    ns.extrasMoveRowToMain = function(key){
        var row = ns.extrasGetRow(key);
        // TODO: update shadow when rows are added
        // var value = row
        row.find('input').addClass("revision-match");
        row.find('.extras-value').show();
        row.find('.shadow').empty().hide();
        row.find('input').show();
        row.find('.extras-delete').show();
        var rowHtml = '<dt class="extras-dt">' +
            $(row[0]).html() + '</dt>' +
            '<dd class="extras-dd">' +
            $(row[1]).html() + '</dd>';
        row.remove();
        $('#extras').find('dl:first').append(rowHtml);
    };

    ns.extrasAddRemovedClicked = function(ev){
        var key = $(ev.target).parent().attr('id').substr("extras-shadow-replace-".length);
        console.log(key);
        ns.extrasMoveRowToMain(key);
        ns.extrasAddedOrRemoved();
    };

    // checks for differences between the current list of extras and 
    // the shadow list
    //
    // only displays shadows for added/removed rows, edit rows are handled by the
    // extrasFieldChanged function
    ns.extrasAddedOrRemoved = function(){
        // get current list of extras by key
        var extras = {};
        var extrasInputs = $('#extras').find('dl:first').find('.extras-dd').find('input');
        extrasInputs.each(function(i){
            if($(this).attr('name').substr("extras__N".length) === "__key"){
                var key = $(this).val();
                var value = $(extrasInputs[i+1]).val();
                extras[ns.urlFriendly(key)] = new ns.Extra(key, value);
            }
        });

        // check for extras added since shadow revision
        for(var i in extras){
            if(ns.extrasGetShadow(extras[i].key) === undefined){
                var row = ns.extrasGetRow(extras[i].key);
                row.find('input').removeClass("revision-match");
                row.find('.extras-value').hide();
                row.find('.shadow').empty().append(
                    '<div class="shadow-value">' + extras[i].value + '</div>'
                );
                var rowHtml = '<dt class="extras-dt">' +
                    $(row[0]).html() + '</dt>' +
                    '<dd class="extras-dd">' +
                    $(row[1]).html() + '</dd>';
                row.remove();
                $('#extras-added-list').prepend(rowHtml);
                $('#extras-added-list .shadow').show();
            }
            else{
                if(!ns.extrasIsInMain(extras[i].key)){
                    ns.extrasMoveRowToMain(extras[i].key);
                }
            }
        }

        // check for extras removed since shadow revision
        var lastLabel = $('#extras-added-list').find('dt:last').find('label');
        var n = parseInt(lastLabel.attr('for').charAt("extras__".length), 10) + 1;
        var extrasRemoved = "";
        for(var i in ns.shadowExtras){
            if(extras[i] === undefined){
                var keyName = "extras__" + n + "__key";
                var valueName = "extras__" + n + "__value";
                var deletedName = "extras__" + n + "__deleted";
                extrasRemoved += '<dt class="extras-dt ' + i + '">' +
                    '<label for="' + valueName +'">' + i + '</label></dt>' +
                    '<dd class="extras-dd ' + i + '">' +
                    '<input id="' + keyName + '" name="' + keyName + '" ' +
                    'type="hidden" value="' + i + '">' +
                    '<div class="extras-value">' +
                    '<input id="' + valueName + '" name="' + valueName + '" ' +
                    'type="text" value="' + ns.shadowExtras[i].value + '">' +
                    '</div>' +
                    '<div class="shadow">' +
                    '<div class="shadow-value">' + ns.shadowExtras[i].value + 
                    '<div><button type="button">Add</button></div>' +
                    '</div>' +
                    '</div>' +
                    '<div class="extras-delete">' +
                    '<input type="checkbox" name="' + deletedName + '"> Delete' +
                    '</div>' +
                    '</dd>';
            }
        }
        if(extrasRemoved != ""){
            $('#extras-removed-list').append(extrasRemoved);
            $('#extras-removed').show();
            $('#extras-removed').find('input').hide();
            $('#extras-removed').find('.extras-delete').hide();
            $('#extras-removed .shadow').show();
            $('#extras-removed').find('button').click(ns.extrasAddRemovedClicked);
            $('#extras-removed').find('button').button({
                icons : {primary:'ui-icon-arrowthick-1-n'}
            });
        }
        else{
            $('#extras-removed .shadow-value').remove();
            $('#extras-removed').hide();
        }

        ns.checkAllMatch();
    };

})(CKANEXT.MODERATEDEDITS, jQuery);
