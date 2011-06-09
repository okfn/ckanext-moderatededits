// CKAN Moderated Edits Extension
var CKANEXT = CKANEXT || {};

CKANEXT.MODERATEDEDITS = {
    // named constants
    STANDARD_FIELD: 0,
    RESOURCES_FIELD: 1,
    EXTRAS_FIELD: 2,
    GROUPS_FIELD: 3,
    REVISION_LIST_MAX_LENGTH: 10,

    // initialisation function, called when the page has finished loading
    init:function(packageName, revisionListURL, revisionDataURL){
        this.packageName = packageName;
        this.revisionListURL = revisionListURL;
        this.revisionDataURL = revisionDataURL;

        // find out if the current user is a moderator by looking for the
        // option to change the package state
        this.isModerator = $('#state').length > 0;
        // enable the sidebar which is where the revision list goes by default
        $('body').removeClass("hide-sidebar");
        // add empty shadow divs that will be filled later if necessary
        this.formInputs = $('#package-edit input[type=text], select, textarea');
        this.formInputs.after('<div class="shadow"></div>');
        // for each form input, decide whether it should have the standard
        // shadow, or if it belongs to a special case (resources, extras, etc)
        //
        // here we do this by checking which fieldset the form item is in
        //
        // another option would be to check the name of the item, as currently
        // resources start with 'resources__', extras with 'extras__', etc.
        this.formInputTypes = {}
        $.each(this.formInputs, function(index, value){
            var legend = $(value).closest('fieldset').children('legend').text();
            if(legend === 'Resources'){
                var inputType = CKANEXT.MODERATEDEDITS.RESOURCES_FIELD;
            }
            else if(legend === 'Extras'){
                var inputType = CKANEXT.MODERATEDEDITS.EXTRAS_FIELD;
            }
            else if(legend === 'Groups'){
                var inputType = CKANEXT.MODERATEDEDITS.GROUPS_FIELD;
            }
            else{
                var inputType = CKANEXT.MODERATEDEDITS.STANDARD_FIELD;
            }
            CKANEXT.MODERATEDEDITS.formInputTypes[$(value).attr('name')] = inputType;
        });
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
        this.fieldNameRegex = /^(\S+)__(\d+)__(\S+)$/; 

        // default active revision is the latest one
        this.activeRevision = 0;
        this.activeRevisionID = null;
        this.activeRevisionMsg = null;
        this.revisions = null;
        this.lastApproved = 0;
        this.shadows = {};
        this.shadowResourceNumbers = {};

        // display revision info box and list
        this.revisionList();
        // add click handler for 'click here for more information' link in info box
        $('a#revision-show-mod-info').click(this.showModInfoClicked);
        // add click handler for 'select latest revision' link in info box
        $('a#revision-select-latest').click(this.latestApprovedClicked);
        //add the input so backend knows this is a revision submit
        hidden_input = '<input name="moderated" value="True" type="hidden">';
        $('.submit input[name="preview"]').before(hidden_input); 
        // add new button for saving a moderated version
        if(this.isModerator){
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

        // callback handler for form fields being changed
        this.formInputs.change(this.inputValueChanged);
        this.formInputs.keyup(this.inputValueChanged);
        // set speed for JQuery fades (in milliseconds)
        this.fadeTime = 500;
        // add a diff-match-patch object to get a diff of textareas
        this.dmp = new diff_match_patch();
        this.dmp.Diff_Timeout = 1;
    },

    // if the active revision is not approved,
    // return the index of the latest approved revision for this package
    //
    // if active revision is approved, or there are no other (approved) revisions,
    // return the active revision index.
    lastApprovedRevision:function(){
        var lastApproved = CKANEXT.MODERATEDEDITS.activeRevision;

        if(CKANEXT.MODERATEDEDITS.revisions && 
           CKANEXT.MODERATEDEDITS.revisions.length > 0){
            if(!this.revisions[CKANEXT.MODERATEDEDITS.activeRevision].current_approved){
                // get the latest approved revision
                for(var i in CKANEXT.MODERATEDEDITS.revisions){
                    if(CKANEXT.MODERATEDEDITS.revisions[i].current_approved){
                        lastApproved = i;
                    }
                }
            }
        }
        
        return lastApproved;
    },

    // display the revision information box
    revisionInfo:function(){
        if(this.isModerator){
            $('#revision-info-moderator').fadeIn(CKANEXT.MODERATEDEDITS.fadeTime);
        }
        else{
            $('#revision-info-moderator').fadeOut(CKANEXT.MODERATEDEDITS.fadeTime);
        }

        this.lastApproved = this.lastApprovedRevision()
        if(this.activeRevision != this.lastApproved){
            $('#revision-info-link-to-latest').fadeIn(CKANEXT.MODERATEDEDITS.fadeTime);
        }
        else{
            $('#revision-info-link-to-latest').fadeOut(CKANEXT.MODERATEDEDITS.fadeTime);
        }

        // test for both to decide whether to hide the whole revision info box or not
        if(this.isModerator || (this.activeRevision != this.lastApproved)){
            $('#revision-info').fadeIn(CKANEXT.MODERATEDEDITS.fadeTime);
        }
        else{
            $('#revision-info').fadeOut(CKANEXT.MODERATEDEDITS.fadeTime);
        }
    },

    // change revision
    changeRevision:function(index){
        CKANEXT.MODERATEDEDITS.activeRevision = index;
        CKANEXT.MODERATEDEDITS.revisionInfo();
        CKANEXT.MODERATEDEDITS.revisionList();
    },

    showModInfoClicked:function(){
        $('#revision-show-mod-info').fadeOut(CKANEXT.MODERATEDEDITS.fadeTime);
        $('#revision-moderator-info').slideToggle();
    },

    latestApprovedClicked:function(){
        CKANEXT.MODERATEDEDITS.changeRevision(CKANEXT.MODERATEDEDITS.lastApproved);
    },

    // callback handler for links in revision list (select revisions)
    revisionClicked:function(e){
        CKANEXT.MODERATEDEDITS.changeRevision($(e.target).attr('id').substr("revision-".length));
    },

    // display the revision list
    // save the list of revisions for this package to this.revisions
    // save the revision ID and log message for the current active revision
    revisionList:function(){
        var success = function(response){
            if(response.length == 0){
                $('#revision-list-msg').empty().replaceWith("No previous revisions found.");
            }
            else{
                var html = "";
                for(var i in response){
                    // TODO: we should really have a way of getting a
                    // date format based on location.
                    //
                    // For now: truncate the timestamp to get the date.
                    // Want YYYY-MM-DD so take the first 10 characters.
                    var revisionDate = response[i].timestamp;

                    html += '<li ';
                    // set active/inactive classes
                    if(i == CKANEXT.MODERATEDEDITS.activeRevision){
                        html += 'id="revision-active" ';
                        // save the revision ID and log message
                        CKANEXT.MODERATEDEDITS.activeRevisionID = response[i].revision_id;
                        CKANEXT.MODERATEDEDITS.activeRevisionMsg = response[i].message;
                    }
                    // set approved class
                    if(response[i].approved){
                        html += 'class="revision-approved"';
                    }
                    else{
                        html += 'class="revision-not-approved"';
                    }
                    html += '>';

                    if(i == CKANEXT.MODERATEDEDITS.activeRevision){
                        html += '<span id="revision-active-text">' + revisionDate +  
                                '</span>' +
                                '<div class="revision-list-buttons">' +
                                '<button id="revision-replace-all"' + 
                                ' title="Replace all fields with values from this revision"></button>' +
                                '<button id="revision-toggle-info"' + 
                                ' title="Display the commit message for this revision"></button>' +
                                '</div>' +
                                '<div id="revision-commit-message">' +
                                response[i].message +
                                '</div>' +
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
                $('a.revision-list-button').click(CKANEXT.MODERATEDEDITS.revisionClicked);
                // add dialog for replace all confirmation box
                $('#revision-replace-all-warning').dialog({
                    autoOpen: false,
                    resizable: false,
                    modal: true,
                    buttons: {
				        "Replace all fields":function(){
                            CKANEXT.MODERATEDEDITS.replaceAllWithShadows();
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
            CKANEXT.MODERATEDEDITS.revisions = response;
            CKANEXT.MODERATEDEDITS.revisionInfo();
            // update the shadow field values
            CKANEXT.MODERATEDEDITS.updateShadows();
        };

        var error = function(response){
            $('#revision-list').append("<li>Error: could not load revision list.</li>");
        };

        $.ajax({method: 'GET',
                url: this.revisionListURL,
                dataType: 'json',
                success: success,
                error: error
        }); 
    },

    // if all fields match, highlight the active revision in green
    checkAllMatch:function(){
        if($('.shadow-value').length){
            $('#revision-active').removeClass("revision-active-match");
            $('#revision-active').addClass("revision-active-nomatch");
        }
        else{
            $('#revision-active').removeClass("revision-active-nomatch");
            $('#revision-active').addClass("revision-active-match");
        }
    },
    
    // update the values of the shadow fields to those of the active revision
    updateShadows:function(){
        var success = function(data){
            CKANEXT.MODERATEDEDITS.shadows = data;
            // save resource number based on ID
            CKANEXT.MODERATEDEDITS.shadowResourceNumbers = {};
            for(var i in data){
                if((i.substr(0, 11) === 'resources__') &&
                   (i.substr(12) === '__id')){
                    CKANEXT.MODERATEDEDITS.shadowResourceNumbers[data[i]] = i.charAt(11);
                }
            }
            CKANEXT.MODERATEDEDITS.allMatchesAndShadows();
        };

        $.ajax({method: 'GET',
                url: this.revisionDataURL + "/" + this.activeRevisionID,
                dataType: 'json',
                success: success
        }); 
    },

    // replace all field values with current shadow values
    replaceAllWithShadows:function(){
        $.each(CKANEXT.MODERATEDEDITS.formInputs, function(index, value){
            var fieldName = $(value).attr('name');
            var shadowValue = CKANEXT.MODERATEDEDITS.shadows[fieldName];
            if(shadowValue != undefined){
                CKANEXT.MODERATEDEDITS.replaceWithShadow(fieldName);
            }
        });
        // TODO: Need to call different functions for different input types, like:
        // if(CKANEXT.MODERATEDEDITS.formInputTypes[fieldName] ==
        //    CKANEXT.MODERATEDEDITS.STANDARD_FIELD){
        //     CKANEXT.MODERATEDEDITS.standardFieldChanged(
        //         field, fieldName, inputValue, shadowValue);
        // }
        // else if(CKANEXT.MODERATEDEDITS.formInputTypes[fieldName] ==
        //    CKANEXT.MODERATEDEDITS.RESOURCES_FIELD){
        //     CKANEXT.MODERATEDEDITS.resourcesMatchOrShadow(
        //         field, fieldName);
        // }
    },

    // replace field value with current shadow values
    replaceWithShadow:function(fieldName){
        var shadowValue = CKANEXT.MODERATEDEDITS.shadows[fieldName];
        var field = $('[name=' + fieldName + ']');
        field.val(shadowValue);
        CKANEXT.MODERATEDEDITS.checkField(field[0]);
    },

    // replace a row in the resource table with its current shadow values
    replaceResourceWithShadow:function(rID){
        var shadowNumber = CKANEXT.MODERATEDEDITS.shadowResourceNumbers[rID];
        CKANEXT.MODERATEDEDITS.replaceWithShadow('resources__' + shadowNumber + '__url');
        CKANEXT.MODERATEDEDITS.replaceWithShadow('resources__' + shadowNumber + '__format');
        CKANEXT.MODERATEDEDITS.replaceWithShadow('resources__' + shadowNumber + '__description');
    },

    // click handler for 'copy value to field' button in shadow area
    copyValueClicked:function(e){
        var fieldName = $(this).attr('id').substr("shadow-replace-".length);
        CKANEXT.MODERATEDEDITS.replaceWithShadow(fieldName);
    },

    // click handler for 'copy' button in resource shadow area
    copyResourceClicked:function(e){
        var rID = $(this).attr('id').substr("resources-shadow-replace-".length);
        CKANEXT.MODERATEDEDITS.replaceResourceWithShadow(rID);
    },

    resourcesReplaceRemovedClicked:function(e){
        var rID = $(this).closest("tr").attr('id').substr("resources-shadow-".length);
        var n = CKANEXT.MODERATEDEDITS.shadowResourceNumbers[rID];

        var table = $(this).closest("fieldset").find("table").first();
        var lastRow = table.find('tr:last');
        var clone = lastRow.clone(true);
        clone.insertAfter(lastRow);

        // set new row values to shadow values
        // 
        // use the native setAttribute function here, as jQuery's .val() or
        // .attr('value') don't actually change the html for value attributes
        clone.find(".resource-url").find("input")[0].setAttribute("value",
            CKANEXT.MODERATEDEDITS.shadows["resources__"+n+"__url"]);
        clone.find(".resource-format").find("input")[0].setAttribute("value",
            CKANEXT.MODERATEDEDITS.shadows["resources__"+n+"__format"]);
        clone.find(".resource-description").find("input")[0].setAttribute("value",
            CKANEXT.MODERATEDEDITS.shadows["resources__"+n+"__description"]);
        clone.find(".resource-id").find("input")[0].setAttribute("value", rID);

        CKANEXT.MODERATEDEDITS.resourceSetRowNumber(
            clone, CKANEXT.MODERATEDEDITS.resourceGetRowNumber(lastRow) + 1);
        // set row numbers in all 'resources added' rows too
        var addedRows = $("#resources-added").find("tr");
        for(var i = 0; i < addedRows.length; i++){
            CKANEXT.MODERATEDEDITS.resourceSetRowNumber(
                addedRows[i], CKANEXT.MODERATEDEDITS.resourceGetRowNumber(addedRows[i]) + 1);
        }

        CKANEXT.MODERATEDEDITS.resourcesAddedOrRemoved();
    },

    resourceGetRowNumber:function(tr){
        var rowNumber = $(tr).find('input').attr('name').match(
            CKANEXT.MODERATEDEDITS.fieldNameRegex)[2];
        return parseInt(rowNumber, 10);
    },

    resourceSetRowNumber:function(tr, num){
        $(tr).find('input').each(function(){
            $(this).attr({
                id:   $(this).attr('id').replace(CKANEXT.MODERATEDEDITS.fieldNameRegex, "$1__" + num + "__$3"),
                name: $(this).attr('name').replace(CKANEXT.MODERATEDEDITS.fieldNameRegex, "$1__" + num + "__$3")
            });
        });
    },

    // click handler for 'remove this row' button in resources being clicked
    removeResourceClicked:function(e){
        if(confirm('Are you sure you wish to remove this row?')){
            var row = $(this).parents('tr');
            var following = row.nextAll();
            row.remove();
            following.each(function(){
                CKANEXT.MODERATEDEDITS.resourceSetRowNumber(this, 
                    CKANEXT.MODERATEDEDITS.resourceGetRowNumber(this) - 1);
            });
            // remove any shadow for this row
            var rID = $(this).closest("tr").find("td.resource-id").find("input").val();
            $('#resources-shadow-' + rID).remove();
            CKANEXT.MODERATEDEDITS.resourcesAddedOrRemoved();
        }
    },

    // callback for key pressed in an edit box (input, textarea)
    inputValueChanged:function(e){
        CKANEXT.MODERATEDEDITS.checkField(e.target);
    },

    // when comparing fields, ignore differences in line endings between
    // different platforms (eg: \r\n vs \n).
    //
    // this function makes sure all line endings a given string are \n.
    normaliseLineEndings:function(input){
        if(input){
            var reNewline = /\u000d[\u000a\u0085]|[\u0085\u2028\u000d\u000a]/g;
            var nl = '\u000a'; // LF
            return input.replace(reNewline, nl);
        }
        return "";
    },

    // show match or shadow for standard form inputs (input, textarea, select)
    standardFieldChanged:function(field, fieldName, inputValue, shadowValue){
        inputValue = CKANEXT.MODERATEDEDITS.normaliseLineEndings(inputValue);
        shadowValue = CKANEXT.MODERATEDEDITS.normaliseLineEndings(shadowValue);

        if(inputValue === shadowValue){
            // fields match, so just set css style
            $(field).addClass("revision-match");
            $(field).next("div").fadeOut(CKANEXT.MODERATEDEDITS.fadeTime, function(){
                $(field).next("div").empty();
                CKANEXT.MODERATEDEDITS.checkAllMatch();
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
                var d = CKANEXT.MODERATEDEDITS.dmp.diff_main(shadowValue, inputValue);
                CKANEXT.MODERATEDEDITS.dmp.diff_cleanupSemantic(d);
                shadow += CKANEXT.MODERATEDEDITS.dmp.diff_prettyHtml(d);
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
                button = button.replace('Copy value to field', 'Clear this field');
            }
            $(field).next("div").append(button); 
            $('button#shadow-replace-' + fieldName).click(CKANEXT.MODERATEDEDITS.copyValueClicked);
            $('button#shadow-replace-' + fieldName).button({
                icons : {primary:'ui-icon-arrowthick-1-n'}
            });

            $(field).next("div").fadeIn(CKANEXT.MODERATEDEDITS.fadeTime);
        }
    },

    // Called when a field in the resources area is edited. Check match/shadow status
    resourcesFieldChanged:function(field, fieldName){
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

        var shadowNumber = CKANEXT.MODERATEDEDITS.shadowResourceNumbers[rID];
        var shadowURL = CKANEXT.MODERATEDEDITS.shadows['resources__' + shadowNumber + '__url'];
        var shadowFormat = CKANEXT.MODERATEDEDITS.shadows['resources__' + shadowNumber + '__format'];
        var shadowDesc = CKANEXT.MODERATEDEDITS.shadows['resources__' + shadowNumber + '__description'];

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
                $('#resources-shadow-replace-' + rID).click(CKANEXT.MODERATEDEDITS.copyResourceClicked);
                $('#resources-shadow-replace-' + rID).button({
                    icons : {primary:'ui-icon-arrowthick-1-n'}
                });
            }
        }

        CKANEXT.MODERATEDEDITS.checkAllMatch();
    },

    // checks for differences between the current list of resources and 
    // the shadow list
    //
    // only displays shadows for added/removed rows, edit rows are handled by the
    // resourcesFieldChanged function
    resourcesAddedOrRemoved:function(){
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

            if(CKANEXT.MODERATEDEDITS.shadowResourceNumbers[i] === undefined){
                row.find("td").removeClass("revision-match-resources");
                row.find("td").addClass("shadow-value");
                row.find("td").addClass("resources-shadow-added");
                resourcesAdded += '<tr class="resources-shadow">' + 
                    row.html() + '</tr>';
                row.remove();
            }
            else{
                // make sure this is in the standard resources table
                if(row.hasClass("resources-shadow")){
                    row.find("td").addClass("revision-match-resources");
                    row.find("td").removeClass("shadow-value");
                    row.find("td").removeClass("resources-shadow-added");
                    $("#resources-added").prev("table").find("tbody").append(
                        '<tr>' + row.html() + '</tr>');
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
        for(var i in CKANEXT.MODERATEDEDITS.shadowResourceNumbers){
            if(resourceNumbers[i] === undefined){
                var n = CKANEXT.MODERATEDEDITS.shadowResourceNumbers[i];

                resourcesRemoved += '<tr class="resources-shadow" ' +
                    'id="resources-shadow-' + i + '">' +
                    '<td class="shadow-value resources-url">' +
                    '<div class="shadow-value-short wordwrap">' +
                    CKANEXT.MODERATEDEDITS.shadows["resources__" + n + "__url"] + 
                    '</div></td>' + 
                    '<td class="shadow-value resources-format">' +
                    '<div class="shadow-value-short wordwrap">' +
                    CKANEXT.MODERATEDEDITS.shadows["resources__" + n + "__format"] + 
                    '</div></td>' + 
                    '<td class="shadow-value resources-description">' +
                    '<div class="shadow-value-medium wordwrap">' +
                    CKANEXT.MODERATEDEDITS.shadows["resources__" + n + "__description"] + 
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
        $('a.remove').click(CKANEXT.MODERATEDEDITS.removeResourceClicked);
        // add click handlers for 'Add bac' buttons
        $('button.resources-shadow-replace-removed').unbind('click');
        $('button.resources-shadow-replace-removed').click(
            CKANEXT.MODERATEDEDITS.resourcesReplaceRemovedClicked);
        $('button.resources-shadow-replace-removed').button({
            icons : {primary:'ui-icon-arrowthick-1-n'}
        });


        CKANEXT.MODERATEDEDITS.checkAllMatch();
    },

    // input value changed, update match/shadow status
    checkField:function(field){
        var fieldName = $(field).attr("name");
        var inputValue = $(field).val();
        var shadowValue = CKANEXT.MODERATEDEDITS.shadows[fieldName];

        // ignore - empty fields to enter resources or extra keys/values
        if(typeof shadowValue === "undefined"){
            return;
        }

        if(CKANEXT.MODERATEDEDITS.formInputTypes[fieldName] ==
           CKANEXT.MODERATEDEDITS.STANDARD_FIELD){
            CKANEXT.MODERATEDEDITS.standardFieldChanged(
                field, fieldName, inputValue, shadowValue);
        }
        else if(CKANEXT.MODERATEDEDITS.formInputTypes[fieldName] ==
           CKANEXT.MODERATEDEDITS.RESOURCES_FIELD){
            CKANEXT.MODERATEDEDITS.resourcesFieldChanged(field, fieldName);
        }

        CKANEXT.MODERATEDEDITS.checkAllMatch();
    },

    // show either shadows or matches for all fields
    allMatchesAndShadows:function(){
        $.each(CKANEXT.MODERATEDEDITS.formInputs, function(index, value){
            CKANEXT.MODERATEDEDITS.checkField(value);
        });
        CKANEXT.MODERATEDEDITS.resourcesAddedOrRemoved();
        CKANEXT.MODERATEDEDITS.checkAllMatch();
    }
};
