// CKAN Moderated Edits Extension
var CKANEXT = CKANEXT || {};

CKANEXT.MODERATEDEDITS = {
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
        // default active revision is the latest one
        this.activeRevision = 0;
        this.activeRevisionID = null;
        this.activeRevisionMsg = null;
        this.revisions = null;
        this.lastApproved = 0;

        // display revision info box and list
        this.revisionList();
        // add click handler for 'click here for more information' link in info box
        $('a#revision-show-mod-info').click(this.showModInfoClicked);
        // add click handler for 'select latest revision' link in info box
        $('a#revision-select-latest').click(this.latestApprovedClicked);

        // change default preview/submit buttons to match style
        $('.submit input[name="preview"]').button(); 
        $('.submit input[name="save"]').button(); 

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
                    var revisionDate = response[i].timestamp.substr(0, 10);

                    html += '<li class="';
                    // set active/inactive classes
                    if(i == CKANEXT.MODERATEDEDITS.activeRevision){
                        html += 'revision-active';
                        // save the revision ID and log message
                        CKANEXT.MODERATEDEDITS.activeRevisionID = response[i].revision_id;
                        CKANEXT.MODERATEDEDITS.activeRevisionMsg = response[i].message;
                    }
                    else{
                        html += 'revision-inactive';
                    }
                    // set approved class
                    if(response[i].current_approved){
                        html += ' revision-approved';
                    }
                    else{
                        html += ' revision-not-approved';
                    }
                    html += '">';

                    if(i == CKANEXT.MODERATEDEDITS.activeRevision){
                        html += '<span id="revision-active-text">' + revisionDate +  
                                '</span>' +
                                '<button id="revision-replace-all"' + 
                                ' title="Replace all fields with values from this revision"></button>' +
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
            }

            // update the revision info box
            CKANEXT.MODERATEDEDITS.revisions = response;
            CKANEXT.MODERATEDEDITS.revisionInfo();
            // update the shadow field values
            CKANEXT.MODERATEDEDITS.updateShadows();
        };

        var error = function(response){
            $('#revision-list').append("<li>fail</li>");
        };

        $.ajax({method: 'GET',
                url: this.revisionListURL,
                dataType: 'json',
                success: success,
                error: error
        }); 
    },
    
    // update the values of the shadow fields to those of the active revision
    updateShadows:function(){
        var success = function(data){
            CKANEXT.MODERATEDEDITS.shadows = data;
            CKANEXT.MODERATEDEDITS.showAllMatchesAndShadows();
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
    },

    // replace field value with current shadow values
    replaceWithShadow:function(fieldName){
        var shadowValue = CKANEXT.MODERATEDEDITS.shadows[fieldName];
        var field = $('[name=' + fieldName + ']');
        field.val(shadowValue);
        CKANEXT.MODERATEDEDITS.showMatchOrShadow(field[0]);
    },

    // click handler for 'copy value to field' button in shadow area
    copyValueClicked:function(e){
        var fieldName = $(this).attr('id').substr("shadow-replace-".length);
        CKANEXT.MODERATEDEDITS.replaceWithShadow(fieldName);
    },

    // callback for key pressed in an edit box (input, textarea)
    inputValueChanged:function(e){
        CKANEXT.MODERATEDEDITS.showMatchOrShadow(e.target);
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

    // show matching fields (have the 'revision-match' class), or shadow fields
    // if the current field differs from the active revision
    showMatchOrShadow:function(field){
        var fieldName = $(field).attr("name");
        var inputValue = $(field).val();
        var revisionValue = CKANEXT.MODERATEDEDITS.shadows[fieldName];

        // ignore - empty fields to enter resources or extra keys/values
        if(typeof revisionValue === "undefined"){
            return;
        }

        inputValue = CKANEXT.MODERATEDEDITS.normaliseLineEndings(inputValue);
        revisionValue = CKANEXT.MODERATEDEDITS.normaliseLineEndings(revisionValue);

        if(inputValue === revisionValue){
            // fields match, so just set css style
            $(field).addClass("revision-match");
            $(field).next("div").fadeOut(CKANEXT.MODERATEDEDITS.fadeTime);
        }
        else{
            // fields don't match - display shadow
            $(field).removeClass("revision-match");
            $(field).next("div").empty();

            // different type of shadow depending on input type
            var shadow = '<div class="shadow-value">';
            if(field.nodeName.toLowerCase() === "input"){
                shadow += revisionValue;
            }
            else if(field.nodeName.toLowerCase() === "textarea"){
                var d = CKANEXT.MODERATEDEDITS.dmp.diff_main(revisionValue, inputValue);
                shadow += CKANEXT.MODERATEDEDITS.dmp.diff_prettyHtml(d);
            }
            else if(field.nodeName.toLowerCase() === "select"){
                // for selects, we want to display the text for the appropriate
                // option rather than the value
                shadow += $(field).children('option[value='+revisionValue+']').text();
            }
            shadow += '</div>';
            $(field).next("div").append(shadow);
            
            // add the 'copy to field' button
            //
            // if the revision value was an empty string, display a different message
            // on the button
            var button = '<button type="button" id="shadow-replace-' + fieldName + '">' +
                         'Copy value to field</button>'
            if($.trim(revisionValue) === ""){
                button = button.replace('Copy value to field', 'Clear this field');
            }
            $(field).next("div").append(button); 
            $('button#shadow-replace-' + fieldName).click(CKANEXT.MODERATEDEDITS.copyValueClicked);
            $('button#shadow-replace-' + fieldName).button(
                {icons : {primary:'ui-icon-arrowthick-1-n'}}
            );

            $(field).next("div").fadeIn(CKANEXT.MODERATEDEDITS.fadeTime);
        }
    },

    // show either shadows or matches for all fields
    showAllMatchesAndShadows:function(){
        $.each(CKANEXT.MODERATEDEDITS.formInputs, function(index, value){
            CKANEXT.MODERATEDEDITS.showMatchOrShadow(value);
        });
    }
};
