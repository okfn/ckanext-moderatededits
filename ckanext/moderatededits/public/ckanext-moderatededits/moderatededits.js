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

        // add click handler for 'select latest revision' link in info box
        $('a#revision-select-latest').click(this.latestApprovedClicked);

        // callback handler for form fields being changed
        this.formInputs.change(this.inputValueChanged);

        // TODO: display revision log message
        // TODO: revision list and save buttons

        // set speed for JQuery fades (in milliseconds)
        this.fadeTime = 500;
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
                var html = '<li>No previous revisions found.</li>';
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
                        html += revisionDate
                    }
                    else{
                        html += '<a id="revision-' + i.toString() + '" ' +
                                'class="revision-list-button">' +
                                revisionDate +
                                '</a>';
                    }
                    html += '</li>';
                }
                html += '<div>Revisions that have been approved by the ' +
                        'moderator are marked with a ' +
                        '<span class="revision-approved-marker">*</span>';
            }
            $('#revision-list').empty().append(html);

            // add a click handlers for revision list URLs
            $('a.revision-list-button').click(CKANEXT.MODERATEDEDITS.revisionClicked);

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

    // click handler for 'copy value to field' button in shadow area
    copyValueClicked:function(e){
        var fieldName = $(e.target).parent().attr('id').substr("shadow-replace-".length);
        var shadowValue = CKANEXT.MODERATEDEDITS.shadows[fieldName];
        var field = $('input[name=' + fieldName + ']');
        field.val(shadowValue);
        CKANEXT.MODERATEDEDITS.showMatchOrShadow(field);
    },

    // callback for key pressed in an edit box (input, textarea)
    inputValueChanged:function(e){
        CKANEXT.MODERATEDEDITS.showMatchOrShadow($(e.target));
    },

    // returns true if the value of a matches the value of b, or if b is undefined
    doesMatch:function(a, b){
        if((a === b) || (typeof b === "undefined")){
            return true;
        }
        return false;
    },

    // show matching fields (have the 'revision-match' class), or shadow fields
    // if the current field differs from the active revision
    showMatchOrShadow:function(field){
        var fieldName = $(field).attr("name");
        var inputValue = $(field).val();
        var revisionValue = CKANEXT.MODERATEDEDITS.shadows[fieldName];

        if(CKANEXT.MODERATEDEDITS.doesMatch(inputValue, revisionValue)){
            // fields match, so just set css style
            $(field).addClass("revision-match");
            $(field).next("div").fadeOut(CKANEXT.MODERATEDEDITS.fadeTime);
        }
        else{
            // fields don't match - display shadow
            $(field).removeClass("revision-match");

            var shadow = '<div class="shadow-value">' + revisionValue + '</div>';
            $(field).next("div").empty().append(shadow).fadeIn(CKANEXT.MODERATEDEDITS.fadeTime);
            
            var button = '<div class="shadow-replace-button">' +
                         '<a id="shadow-replace-' + fieldName + '" ' +
                         '   class="button pcb"><span>Copy value to field</span></a>' +
                         '</div>'
            $(field).next("div").append(button); 
            $('a#shadow-replace-' + fieldName).click(CKANEXT.MODERATEDEDITS.copyValueClicked);
        }
    },

    // show either shadows or matches for all fields
    showAllMatchesAndShadows:function(){
        $.each(CKANEXT.MODERATEDEDITS.formInputs, function(index, value){
            CKANEXT.MODERATEDEDITS.showMatchOrShadow(value);
        });
    }
};
