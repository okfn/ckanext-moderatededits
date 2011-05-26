// CKAN Moderated Edits Extension

var CKANEXT = CKANEXT || {};

CKANEXT.MODERATEDEDITS = {
    init:function(packageName, revisionListURL, isModerator){
        this.packageName = packageName;
        this.revisionListURL = revisionListURL;
        this.isModerator = isModerator;

        $('body').removeClass("hide-sidebar");
        this.activeRevision = 0;
        this.revisionInfo();
        this.revisionList();
    },

    // display the revision information box
    revisionInfo:function(){
        var html = '';
        if(this.isModerator){
            html += '<span class="revision-info-item">';
            html += 'You are a moderator for this package. ';
            html += '<a href="">Click here to find out what this means.</a>';
            html += '</span>';
        }
        html += '<span class="revision-info-item">';
        html += 'Your changes are being compared to an unmoderated revision. ';
        html += '<a href="">Click here to compare them to the latest moderated revision.</a>';
        html += '</span>';
        $('div#revision-info').empty().append(html);
    },

    // change revision
    changeRevision:function(){
        alert('change revision');
    },

    // display the revision list
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
            $('a.revision-list-button').click(CKANEXT.MODERATEDEDITS.changeRevision);
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
    }
};
